/**
 * send-pack-change-notification — tells the people holding a calendar entry for
 * a BattlePack event when that event moves or comes down.
 *
 * Called by the Postgres triggers in 20260820010000, never by a browser. The
 * recipients are the rows of `battlepack_calendar_adds`, which exist for
 * exactly this: an attendee's calendar is a copy of the event that we cannot
 * reach, and a copy nobody corrects is worse than no copy at all.
 *
 * WHO TO WRITE TO IS THE DATABASE'S DECISION, NOT THIS FILE'S. "Their date no
 * longer matches, and we have not already said so" is a comparison between two
 * dates plus a suppression check, and Postgres already owns the definition of
 * whether two dates are the same. Rebuilding that here would be one rule in two
 * languages. So this asks — `battlepack_stale_calendar_adds` for a move,
 * `battlepack_calendar_audience` for a withdrawal — and is told.
 *
 * Contract — POST one of:
 *   { event: 'moved',     pack_id }        who is stale is looked up
 *   { event: 'extended',  pack_id }        a recurring series gained dates —
 *                                          same audience as a move, different
 *                                          words, because nothing they already
 *                                          hold has become wrong
 *   { event: 'withdrawn', pack_id }        everyone who saved it
 *   { event: 'deleted',   pack: {…}, recipients: [user_id] }
 *                                          the row is GONE and the adds
 *                                          cascaded with it, so the trigger
 *                                          sends both along
 *
 * MARKING HAPPENS AFTER RESEND ACCEPTS, and only for the addresses it accepted.
 * A send that fails halfway leaves the rest still owed their email rather than
 * marking them told and moving on.
 *
 * Env (set with `supabase secrets set` — never committed):
 *   RESEND_API_KEY          Resend key (shared with the booking functions)
 *   FROM_EMAIL              a sender on the verified domain
 *   PACK_WEBHOOK_SECRET     shared with the Postgres trigger; falls back to
 *   BOOKING_WEBHOOK_SECRET  the booking one, which gates the same thing
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Escape a value for interpolation into the email's HTML body. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * '2026-09-19' → 'Saturday, September 19, 2026'.
 *
 * Built from the parts, never `new Date('2026-09-19')`, which is parsed as UTC
 * midnight and prints as the day before to anyone west of Greenwich. Getting
 * this wrong in an email ABOUT A DATE CHANGE would be its own small disaster.
 */
function formatDate(iso: string | null): string {
  if (!iso) return 'no date set';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dow = DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dow}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

/** '10:00:00' → '10:00 AM'. */
function formatTime(time: string | null): string {
  if (!time) return '';
  const [h, min] = time.split(':');
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return time;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 === 0 ? 12 : hour % 12}:${min} ${ampm}`;
}

/** The one line a reader compares against their diary. */
function whenLine(startsOn: string | null, endsOn: string | null, startsAt: string | null): string {
  const start = formatDate(startsOn);
  const end   = endsOn && endsOn !== startsOn ? ` – ${formatDate(endsOn)}` : '';
  const time  = startsAt ? ` at ${formatTime(startsAt)}` : '';
  return `${start}${end}${time}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Where a published pack lives. Canonical, never a preview host. */
const SITE = 'https://battlepack.app';

/**
 * How many people one invocation will write to.
 *
 * An Edge Function has a wall clock, and a pack with thousands of saves would
 * hit it partway through and mark an arbitrary prefix as told. The cap is far
 * above any real event; if it is ever reached that is logged as an error rather
 * than passed over, because "we told everyone" and "we told the first 200"
 * must not look the same in the logs.
 */
const MAX_RECIPIENTS = 200;

/** How many sends are in flight at once. Resend is fine with more; this is politeness. */
const SEND_CONCURRENCY = 5;

// ── Types ─────────────────────────────────────────────────────────────────────

type ChangeEvent = 'moved' | 'extended' | 'withdrawn' | 'deleted';

interface PackData {
  id:        string;
  name:      string;
  slug:      string | null;
  starts_on: string | null;
  ends_on:   string | null;
  starts_at: string | null;
}

interface Recipient {
  user_id:        string;
  held_starts_on: string | null;
  held_ends_on:   string | null;
  held_starts_at: string | null;
  /** Only on the 'moved' path: the pack's current date, as the query saw it. */
  signature?:     string;
  /** Both sides whole, so the email can name the days that differ. */
  held_schedule?:    ScheduleEntry[];
  current_schedule?: ScheduleEntry[];
}

// ── Email ─────────────────────────────────────────────────────────────────────

/** One day of a schedule, as the signature stores it. */
interface ScheduleEntry { on: string | null; at: string | null }

/** A day whose date or time is not what this person has in their calendar. */
interface DayChange { label: string; from: string; to: string }

/**
 * Which days differ, and how.
 *
 * Compared position by position: the segments are ordered, so day two is day
 * two on both sides. A day added to the end shows as an addition rather than
 * being silently dropped, and a day removed shows as a removal — either is
 * something an attendee's diary is now wrong about.
 */
function changedDays(held: ScheduleEntry[], current: ScheduleEntry[]): DayChange[] {
  const many = Math.max(held.length, current.length) > 1;
  const out: DayChange[] = [];

  for (let i = 0; i < Math.max(held.length, current.length); i++) {
    const was = held[i];
    const now = current[i];
    const label = many ? `Day ${i + 1}` : 'The event';

    if (was && now) {
      if (was.on === now.on && was.at === now.at) continue;
      out.push({
        label,
        from: whenLine(was.on, null, was.at),
        to:   whenLine(now.on, null, now.at),
      });
    } else if (was && !now) {
      out.push({ label, from: whenLine(was.on, null, was.at), to: 'no longer happening' });
    } else if (!was && now) {
      out.push({ label, from: 'not previously scheduled', to: whenLine(now.on, null, now.at) });
    }
  }
  return out;
}

/**
 * One layout, four messages.
 *
 * DELIBERATELY NOT AN .ics ATTACHMENT. The obvious idea is to attach a
 * corrected event and let the calendar update itself — the UID is stable
 * precisely so that can work. It is not reliable: updating an existing entry
 * properly is an invitation flow (METHOD:REQUEST, an organiser, an attendee, a
 * sequence number), and a plain published .ics lands as a SECOND event in
 * enough clients that the fix would be worse than the problem. So the email
 * links to the pack, where "Add to Calendar" re-adds through the same client
 * that made the original entry and updates it in place — and re-adding also
 * refreshes what we believe they are holding, which closes the loop.
 *
 * 'extended' IS NOT A MOVE, and gets its own words for that reason. Every date
 * already in somebody's calendar is still correct; the series simply runs
 * longer. Telling them their date changed would be wrong as well as alarming,
 * and keeping the green accent rather than the red one is part of saying so.
 */
function renderEmail(opts: {
  event: ChangeEvent;
  pack: PackData;
  heldWhen: string | null;
  changes: DayChange[];
}): { subject: string; html: string; text: string } {
  const { event, pack, heldWhen, changes } = opts;

  const url = pack.slug ? `${SITE}/${pack.slug}` : null;
  const off = event === 'withdrawn' || event === 'deleted';

  const accent = off ? '#b91c1c' : '#059669';

  const title = off ? '❌ Event Cancelled'
    : event === 'extended' ? '📅 More Dates Added'
    : '📅 The Date Has Changed';

  const subject = off ? `Cancelled: ${pack.name}`
    : event === 'extended' ? `More dates added: ${pack.name}`
    : `Date changed: ${pack.name}`;

  const lead = off
    ? `${esc(pack.name)} is no longer going ahead.`
    : event === 'extended'
      ? `${esc(pack.name)} is running for longer.`
      : `The organiser has moved ${esc(pack.name)}.`;

  /** The old-to-new rows, which are the whole point of the moved email. */
  const changeRows = changes.map(c => `
        <div class="detail now">
          <div class="label">${esc(c.label)}</div>
          <div class="value"><span style="color:#6b7280;text-decoration:line-through">${esc(c.from)}</span> &rarr; <strong>${esc(c.to)}</strong></div>
        </div>`).join('');

  const body = off
    ? `
        <p>You added this event to your calendar, so we thought you would want to
           know. ${event === 'deleted'
             ? 'The organiser has removed the event entirely.'
             : 'The organiser has taken the event page down. It may come back — the address still belongs to it.'}</p>
        ${heldWhen ? `
        <div class="detail">
          <div class="label">It was in your calendar for</div>
          <div class="value">${esc(heldWhen)}</div>
        </div>` : ''}
        <p><strong>Your calendar still has it.</strong> Nothing we do can remove
           an entry from your diary, so you will want to delete it yourself.</p>
      `
    : event === 'extended'
      ? `
        <p>You added this event to your calendar. The organiser has added more
           dates to the end of it — <strong>nothing already in your calendar has
           changed</strong>, so there is nothing to correct.</p>
        <p>Open the event page and press <em>Add to Calendar</em> again to pick
           up the new dates.</p>
      `
      : `
        <p>You added this event to your calendar, and the date it is in there
           for is no longer the date it is happening.</p>
        ${changeRows || (heldWhen ? `
        <div class="detail was">
          <div class="label">In your calendar</div>
          <div class="value">${esc(heldWhen)}</div>
        </div>` : '')}
        <p><strong>Your calendar has not updated itself.</strong> Open the event
           page and press <em>Add to Calendar</em> again — your calendar will
           recognise it as the same event and correct the entry rather than
           adding a second one.</p>
      `;

  const button = url
    ? `<p style="margin:24px 0"><a class="btn" href="${esc(url)}">${
        off ? 'View the event page'
        : event === 'extended' ? 'Open the event and add the new dates'
        : 'Open the event and re-add it'
      }</a></p>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${accent}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0 0 8px; font-size: 22px; }
        .header p { margin: 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .detail { background: white; padding: 14px 16px; border-radius: 8px; margin: 12px 0; border-left: 4px solid #d1d5db; }
        .detail.was .value { text-decoration: line-through; color: #6b7280; }
        .detail.now { border-left-color: ${accent}; }
        .label { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; font-weight: bold; }
        .value { font-size: 16px; color: #111827; }
        .btn { display: inline-block; background: ${accent}; color: white; text-decoration: none;
               padding: 12px 20px; border-radius: 8px; font-weight: bold; }
        .footer { margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px; font-size: 12px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
            <p>${lead}</p>
        </div>
        <div class="content">
            ${body}
            ${button}
        </div>
        <div class="footer">
            <p>You are getting this because you added this event to your calendar
               from BattlePack. It is the only reason we would write to you about it.</p>
        </div>
    </div>
</body>
</html>
  `;

  const plainChanges = changes.map(c => `- ${c.label}: ${c.from} -> ${c.to}`).join('\n');

  const text = off
    ? `${pack.name} is no longer going ahead.

${event === 'deleted'
  ? 'The organiser has removed the event entirely.'
  : 'The organiser has taken the event page down. It may come back — the address still belongs to it.'}
${heldWhen ? `\nIt was in your calendar for: ${heldWhen}\n` : ''}
Your calendar still has it — nothing we do can remove an entry from your diary,
so you will want to delete it yourself.
${url ? `\n${url}\n` : ''}
You are getting this because you added this event to your calendar from BattlePack.`
    : event === 'extended'
      ? `${pack.name} is running for longer.

The organiser has added more dates to the end of it. Nothing already in your
calendar has changed, so there is nothing to correct — open the event page and
press "Add to Calendar" again to pick up the new dates.
${url ? `\n${url}\n` : ''}
You are getting this because you added this event to your calendar from BattlePack.`
      : `The organiser has moved ${pack.name}.
${plainChanges ? `\n${plainChanges}\n` : heldWhen ? `\nIn your calendar: ${heldWhen}\n` : ''}
Your calendar has not updated itself. Open the event page and press
"Add to Calendar" again — your calendar will recognise it as the same event and
correct the entry rather than adding a second one.
${url ? `\n${url}\n` : ''}
You are getting this because you added this event to your calendar from BattlePack.`;

  return { subject, html, text };
}


// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    // Only our own Postgres trigger should be able to send mail through this.
    // PACK_WEBHOOK_SECRET if it has been split out, the booking one otherwise —
    // it gates the identical thing, and standing up a second secret means
    // creating it in two places that cannot check each other.
    const expectedSecret =
      Deno.env.get('PACK_WEBHOOK_SECRET') ?? Deno.env.get('BOOKING_WEBHOOK_SECRET');
    if (!expectedSecret) {
      console.error('No webhook secret is configured');
      return json({ success: false, error: 'Not configured' }, 500);
    }
    if (req.headers.get('x-booking-secret') !== expectedSecret) {
      console.warn('Rejected a request with a missing or wrong shared secret');
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase configuration missing');
    const supabase = createClient(supabaseUrl, serviceKey);

    const payload = await req.json().catch(() => ({}));
    const event = payload.event as ChangeEvent;
    if (!['moved', 'extended', 'withdrawn', 'deleted'].includes(event)) {
      return json({ success: false, error: `Unknown event: ${event}` }, 400);
    }

    // ── Who, and about what ──────────────────────────────────────────────────
    let pack: PackData;
    let recipients: Recipient[];
    let signature: string | null = null;

    if (event === 'deleted') {
      // The row is gone and the adds cascaded with it, so both arrived in the
      // payload. Nothing to mark afterwards — there is nothing left to mark.
      if (!payload.pack?.id) return json({ success: false, error: 'pack is required for a deletion' }, 400);
      pack = payload.pack as PackData;
      recipients = ((payload.recipients ?? []) as string[]).map(id => ({
        user_id: id, held_starts_on: null, held_ends_on: null, held_starts_at: null,
      }));
    } else {
      const packId = payload.pack_id;
      if (!packId) return json({ success: false, error: 'pack_id is required' }, 400);

      const { data, error } = await supabase
        .from('battlepacks')
        .select('id, name, slug, starts_on, ends_on, starts_at')
        .eq('id', packId)
        .single();
      if (error || !data) throw new Error(`Failed to fetch pack: ${error?.message ?? 'not found'}`);
      pack = data as PackData;

      if (event === 'moved' || event === 'extended') {
        const { data: stale, error: staleErr } = await supabase
          .rpc('battlepack_stale_calendar_adds', { pack: packId });
        if (staleErr) throw new Error(`Failed to fetch recipients: ${staleErr.message}`);
        recipients = (stale ?? []) as Recipient[];
        // Taken from the query rather than rebuilt here, so what gets marked is
        // exactly what the audience was chosen against. Every row carries the
        // same value — it describes the pack, not the person.
        signature = recipients[0]?.signature ?? null;
      } else {
        const { data: all, error: allErr } = await supabase
          .rpc('battlepack_calendar_audience', { pack: packId });
        if (allErr) throw new Error(`Failed to fetch audience: ${allErr.message}`);
        recipients = ((all ?? []) as { user_id: string }[]).map(r => ({
          user_id: r.user_id, held_starts_on: null, held_ends_on: null, held_starts_at: null,
        }));
      }
    }

    if (recipients.length === 0) {
      console.log(`No one to tell about ${event} on pack ${pack.id}`);
      return json({ success: true, sent: 0 });
    }

    if (recipients.length > MAX_RECIPIENTS) {
      // Loud, because a silent truncation reads as "everybody was told".
      console.error(
        `pack ${pack.id}: ${recipients.length} recipients exceeds the ${MAX_RECIPIENTS} cap — ` +
        `${recipients.length - MAX_RECIPIENTS} will NOT be emailed for this change`,
      );
      recipients = recipients.slice(0, MAX_RECIPIENTS);
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL');
    if (!resendKey) throw new Error('RESEND_API_KEY not configured');
    if (!fromEmail) throw new Error('FROM_EMAIL not configured');

    // ── Send ─────────────────────────────────────────────────────────────────
    const delivered: string[] = [];
    const failed: string[] = [];

    const sendTo = async (r: Recipient) => {
      // auth.users is not reachable through PostgREST, so the address comes
      // from the admin API one at a time. Fine at this scale, and it means a
      // deleted account simply has no address rather than breaking the batch.
      const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(r.user_id);
      const address = userData?.user?.email;
      if (userErr || !address) {
        console.warn(`No address for ${r.user_id}: ${userErr?.message ?? 'no email on the account'}`);
        failed.push(r.user_id);
        return;
      }

      const heldWhen = r.held_starts_on
        ? whenLine(r.held_starts_on, r.held_ends_on, r.held_starts_at)
        : null;
      // Empty for a withdrawal or a deletion, where nothing moved — and empty
      // when the query did not return both sides, which falls the email back to
      // the single held line rather than saying nothing.
      const changes = r.held_schedule && r.current_schedule
        ? changedDays(r.held_schedule, r.current_schedule)
        : [];
      const { subject, html, text } = renderEmail({ event, pack, heldWhen, changes });

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromEmail, to: [address], subject, html, text }),
      });

      if (!res.ok) {
        console.error(`Resend rejected the message for ${r.user_id} (${res.status}): ${await res.text()}`);
        failed.push(r.user_id);
        return;
      }
      delivered.push(r.user_id);
    };

    for (let i = 0; i < recipients.length; i += SEND_CONCURRENCY) {
      await Promise.allSettled(recipients.slice(i, i + SEND_CONCURRENCY).map(sendTo));
    }

    // ── Mark, but only what actually went ────────────────────────────────────
    if ((event === 'moved' || event === 'extended') && signature && delivered.length > 0) {
      const { error: markErr } = await supabase.rpc('battlepack_mark_calendar_notified', {
        pack: pack.id, who: delivered, sig: signature,
      });
      // Worth knowing about but not worth failing over: the emails are already
      // gone, and the cost of not marking is a duplicate on the next change.
      if (markErr) console.error(`Failed to mark ${delivered.length} as notified: ${markErr.message}`);
    }

    console.log(`pack ${pack.id} ${event}: ${delivered.length} sent, ${failed.length} failed`);
    return json({ success: true, sent: delivered.length, failed: failed.length });

  } catch (error) {
    console.error('send-pack-change-notification failed:', error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
