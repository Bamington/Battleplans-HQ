/**
 * send-booking-invite — tells someone a venue booked them a table, and invites
 * them to BattlePlan to see it.
 *
 * Called by the `bookings_invite_guest` Postgres trigger when a venue takes a
 * booking for an email address that has no account yet. Same shape as its two
 * siblings: shared-secret gate, a bare `{ booking_id }` payload, and every
 * displayed value read back from the database with the service role — so
 * knowing the URL and the secret still doesn't let anyone dictate what the
 * email says.
 *
 * Two things specific to this one:
 *
 *   1. It re-checks the send conditions after reading the row. The trigger
 *      already filtered, but this is the thing that actually emails a member of
 *      the public, so it verifies for itself that the booking is still
 *      unclaimed, still has an address, and hasn't already been written to.
 *
 *   2. `invite_sent_at` is stamped only after Resend accepts. A failed send
 *      leaves it null, so the row still looks un-invited and a retry is
 *      possible — rather than silently swallowing the one email that mattered.
 *
 * The address must sign up with THIS email for handle_new_user() to claim the
 * booking, so the email says so in as many words.
 *
 * Env (set with `supabase secrets set` — never committed):
 *   RESEND_API_KEY          Resend key
 *   FROM_EMAIL              a sender on the verified domain
 *   BOOKING_WEBHOOK_SECRET  shared with the Postgres trigger
 *   APP_URL                 optional; defaults below
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_APP_URL = 'https://battleplan.app';

/** Escape a value for interpolation into the email's HTML body. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** '2026-07-20' → 'Monday, July 20, 2026', with no timezone involved. */
function formatBookingDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dow = DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dow}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

/** '18:00:00' → '6:00 PM'. */
function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

interface BookingRow {
  id:             string;
  date:           string;
  user_id:        string | null;
  user_name:      string | null;
  user_email:     string | null;
  invite_sent_at: string | null;
  location_name:       string | null;
  timeslot_name:       string | null;
  timeslot_start_time: string | null;
  timeslot_end_time:   string | null;
  location: { name: string; address: string | null } | null;
  timeslot: { name: string; start_time: string; end_time: string } | null;
  game:     { name: string } | null;
}

function renderEmail(b: BookingRow, appUrl: string): { subject: string; html: string; text: string } {
  // Prefer the per-booking snapshot, same as the app does, so a venue renaming
  // itself later doesn't rewrite what this booking was.
  const venue = b.location_name ?? b.location?.name ?? 'the venue';
  const when  = formatBookingDate(b.date);
  const start = b.timeslot_start_time ?? b.timeslot?.start_time ?? null;
  const end   = b.timeslot_end_time   ?? b.timeslot?.end_time   ?? null;
  const time  = start && end ? `${formatTime(start)} – ${formatTime(end)}` : '';
  const guest = b.user_name?.trim() || null;

  const rows: [string, string][] = [
    ['Venue', venue],
    ['Date',  when],
  ];
  if (time)      rows.push(['Time', time]);
  if (b.game)    rows.push(['Game', b.game.name]);
  if (b.location?.address) rows.push(['Address', b.location.address]);

  const greeting = guest ? `Hi ${guest},` : 'Hi,';
  const signupUrl = `${appUrl}/login`;

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0 0 4px; font-size: 22px; }
        .header p { margin: 0; opacity: 0.9; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 0 0 15px; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: bold; color: #6b7280; }
        .detail-value { color: #111827; }
        .cta { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; }
        .footer { margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px; font-size: 12px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎲 Your table is booked</h1>
            <p>${esc(venue)} reserved a table for you</p>
        </div>

        <div class="content">
            <p>${esc(greeting)}</p>
            <p>${esc(venue)} has booked a table for you on BattlePlan. Here are the details:</p>

            <div class="details">
${rows.map(([label, value]) => `                <div class="detail-row">
                    <span class="detail-label">${esc(label)}:</span>
                    <span class="detail-value">${esc(value)}</span>
                </div>`).join('\n')}
            </div>

            <p>
                You don't need an account to turn up — the venue has your table either
                way. But if you join BattlePlan you'll be able to see this booking,
                change or cancel it, and keep a record of the games you play.
            </p>

            <p style="text-align: center; margin: 24px 0;">
                <a class="cta" href="${esc(signupUrl)}">Join BattlePlan</a>
            </p>

            <p>
                <strong>Sign up with this email address (${esc(b.user_email)})</strong> and
                this booking will already be waiting for you.
            </p>
        </div>

        <div class="footer">
            <p>
                You're getting this because ${esc(venue)} booked a table in your name.
                If that wasn't you, you can ignore this email — no account has been
                created, and nothing else will be sent.
            </p>
        </div>
    </div>
</body>
</html>
  `;

  const text = `${greeting}

${venue} has booked a table for you on BattlePlan.

${rows.map(([label, value]) => `- ${label}: ${value}`).join('\n')}

You don't need an account to turn up — the venue has your table either way.
But if you join BattlePlan you'll be able to see this booking, change or
cancel it, and keep a record of the games you play.

Join BattlePlan: ${signupUrl}

Sign up with this email address (${b.user_email}) and this booking will
already be waiting for you.

You're getting this because ${venue} booked a table in your name. If that
wasn't you, you can ignore this email — no account has been created, and
nothing else will be sent.`;

  return { subject: `${venue} booked you a table on ${when}`, html, text };
}

serve(async (req) => {
  try {
    const expectedSecret = Deno.env.get('BOOKING_WEBHOOK_SECRET');
    if (!expectedSecret) {
      console.error('BOOKING_WEBHOOK_SECRET is not configured');
      return json({ success: false, error: 'Not configured' }, 500);
    }
    if (req.headers.get('x-booking-secret') !== expectedSecret) {
      console.warn('Rejected a request with a missing or wrong shared secret');
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase configuration missing');

    const { booking_id } = await req.json().catch(() => ({}));
    if (!booking_id) return json({ success: false, error: 'booking_id is required' }, 400);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, date, user_id, user_name, user_email, invite_sent_at,
        location_name, timeslot_name, timeslot_start_time, timeslot_end_time,
        location:locations(name, address),
        timeslot:timeslots(name, start_time, end_time),
        game:game_catalogue(name)
      `)
      .eq('id', booking_id)
      .single();
    if (error || !data) throw new Error(`Failed to fetch booking: ${error?.message ?? 'not found'}`);

    const booking = data as unknown as BookingRow;

    // Re-check rather than trust the trigger: this is the step that emails a
    // member of the public, so it decides for itself.
    if (booking.user_id) {
      console.log(`Booking ${booking_id} already belongs to an account; not inviting`);
      return json({ success: true, skipped: 'already claimed' });
    }
    if (!booking.user_email) {
      console.log(`Booking ${booking_id} has no email; nothing to invite`);
      return json({ success: true, skipped: 'no email' });
    }
    if (booking.invite_sent_at) {
      console.log(`Booking ${booking_id} was already invited at ${booking.invite_sent_at}`);
      return json({ success: true, skipped: 'already sent' });
    }

    const appUrl = Deno.env.get('APP_URL') ?? DEFAULT_APP_URL;
    const { subject, html, text } = renderEmail(booking, appUrl);

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL');
    if (!resendKey) throw new Error('RESEND_API_KEY not configured');
    if (!fromEmail) throw new Error('FROM_EMAIL not configured');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [booking.user_email],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend error (${res.status}): ${detail}`);
    }

    const result = await res.json();

    // Only now — a failed send leaves this null so the row still reads as
    // un-invited and can be retried.
    const { error: stampErr } = await supabase
      .from('bookings')
      .update({ invite_sent_at: new Date().toISOString() })
      .eq('id', booking.id);
    if (stampErr) {
      // The person has their email; losing the stamp is the lesser problem.
      console.error(`Sent invite for ${booking.id} but failed to stamp invite_sent_at: ${stampErr.message}`);
    }

    console.log(`Sent booking invite for ${booking.id} to ${booking.user_email}`);
    return json({ success: true, email_id: result.id });

  } catch (error) {
    console.error('send-booking-invite failed:', error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
