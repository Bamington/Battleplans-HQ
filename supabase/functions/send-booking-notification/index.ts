/**
 * send-booking-notification — emails a venue when one of their tables is booked.
 *
 * Ported from the previous BattlePlan app (which ran in its own Supabase
 * project), keeping the same Resend account, verified sending domain and email
 * design. The function couldn't simply be called across projects: it reads the
 * booking back from *its own* database, so it has to live alongside the data.
 *
 * Three things changed on the way over:
 *   1. Every user-supplied value is HTML-escaped. `bookings.user_name` is free
 *      text typed per booking (one account in this data used 36 different
 *      names), so it can't be trusted in an email body.
 *   2. The endpoint is gated on a shared secret. It's now called by a Postgres
 *      trigger rather than the browser, so it no longer needs open CORS — and
 *      without a gate, anyone knowing the URL could re-send a store's
 *      notifications at will.
 *   3. Dates are formatted from their parts rather than via `new Date(...)`,
 *      so a 'YYYY-MM-DD' can't drift a day across timezones.
 *
 * Contract — POST one of:
 *   { event: 'created',   booking_id }  the row is read back from the database
 *   { event: 'cancelled', booking: {…} } the row is GONE (cancelling deletes it),
 *                                        so the trigger sends its values along
 * A bare { booking_id } is treated as 'created', matching the old app.
 *
 * Env (set with `supabase secrets set` — never committed):
 *   RESEND_API_KEY          Resend key, from the same account as the old app
 *   FROM_EMAIL              a sender on the verified domain
 *   BOOKING_WEBHOOK_SECRET  shared with the Postgres trigger
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

/** '2026-07-20' → 'Monday, July 20, 2026', with no timezone involved. */
function formatBookingDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dow = DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dow}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

/** '18:00:00' → '6:00 PM'. */
function formatTime(time: string | null): string {
  if (!time) return 'N/A';
  const [h, min] = time.split(':');
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return time;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${min} ${ampm}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The booking columns both paths need — fetched for 'created', supplied for 'cancelled'. */
interface BookingData {
  id:          string;
  date:        string;
  user_name:   string | null;
  user_email:  string | null;
  location_id: string;
  timeslot_id: string | null;
  game_id:     string | null;
}

// ── Email ─────────────────────────────────────────────────────────────────────

/**
 * Both emails share a layout; only the accent, headings and closing advice
 * differ, so a store can tell them apart at a glance.
 */
function renderEmail(opts: {
  cancelled:    boolean;
  booking:      BookingData;
  locationName: string;
  address:      string | null;
  bookingDate:  string;
  slotName:     string;
  startTime:    string;
  endTime:      string;
  gameName:     string | null;
}): { subject: string; html: string; text: string } {
  const { cancelled, booking, locationName, address, bookingDate, slotName, startTime, endTime, gameName } = opts;

  const accent  = cancelled ? '#b91c1c' : '#4f46e5';
  const title   = cancelled ? '❌ Booking Cancelled' : '🎲 New Table Booking';
  const lead    = cancelled
    ? `A booking at ${esc(locationName)} has been cancelled`
    : `You have received a new booking at ${esc(locationName)}`;
  const subject = cancelled
    ? `Booking Cancelled at ${locationName} - ${bookingDate}`
    : `New Booking at ${locationName} - ${bookingDate}`;

  const nextSteps = cancelled
    ? `<li>This table is free again for the slot above</li>
                <li>No action needed unless you'd taken it out of your own system</li>`
    : `<li>Prepare the table for the scheduled time</li>
                <li>Contact the customer if you need to reschedule: ${esc(booking.user_email)}</li>
                <li>Update your internal booking system if needed</li>`;

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${accent}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: bold; color: #6b7280; }
        .detail-value { color: #111827; }
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
            <div class="booking-details">
                <h2>📅 Booking Details</h2>

                <div class="detail-row">
                    <span class="detail-label">Booking ID:</span>
                    <span class="detail-value">#${esc(String(booking.id).slice(0, 8))}</span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">Customer Name:</span>
                    <span class="detail-value">${esc(booking.user_name)}</span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">Customer Email:</span>
                    <span class="detail-value">${esc(booking.user_email)}</span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span class="detail-value">${esc(bookingDate)}</span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">Time Slot:</span>
                    <span class="detail-value">${esc(slotName)} (${esc(startTime)} - ${esc(endTime)})</span>
                </div>

                ${gameName ? `
                <div class="detail-row">
                    <span class="detail-label">Game:</span>
                    <span class="detail-value">${esc(gameName)}</span>
                </div>
                ` : ''}

                <div class="detail-row">
                    <span class="detail-label">Location:</span>
                    <span class="detail-value">${esc(locationName)}<br><small>${esc(address)}</small></span>
                </div>
            </div>

            <p><strong>Next Steps:</strong></p>
            <ul>
                ${nextSteps}
            </ul>
        </div>

        <div class="footer">
            <p>This notification was sent automatically when a customer ${cancelled ? 'cancelled a booking' : 'made a booking'} through your online booking system.</p>
        </div>
    </div>
</body>
</html>
  `;

  const text = `
${cancelled ? 'Booking Cancelled' : 'New Table Booking'} at ${locationName}

Booking Details:
- Booking ID: #${String(booking.id).slice(0, 8)}
- Customer: ${booking.user_name} (${booking.user_email})
- Date: ${bookingDate}
- Time: ${slotName} (${startTime} - ${endTime})
${gameName ? `- Game: ${gameName}` : ''}
- Location: ${locationName}, ${address ?? ''}

${cancelled
    ? 'This table is free again for the slot above.'
    : 'Please prepare the table for the scheduled time and contact the customer if needed.'}
  `;

  return { subject, html, text };
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    // Only the Postgres trigger should be able to send mail through this.
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
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Supabase configuration missing');
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const payload = await req.json().catch(() => ({}));
    const cancelled = payload.event === 'cancelled';

    // A cancelled booking has already been deleted, so there's nothing to read
    // back — the trigger sends its values instead.
    let booking: BookingData;
    if (cancelled) {
      if (!payload.booking?.id) {
        return json({ success: false, error: 'booking is required for a cancellation' }, 400);
      }
      booking = payload.booking as BookingData;
    } else {
      const booking_id = payload.booking_id;
      if (!booking_id) return json({ success: false, error: 'booking_id is required' }, 400);

      // Read the relations separately rather than as one embedded select, so a
      // missing optional relation can't fail the whole lookup.
      const { data, error: bookingErr } = await supabase
        .from('bookings')
        .select('id, date, user_name, user_email, location_id, timeslot_id, game_id')
        .eq('id', booking_id)
        .single();
      if (bookingErr || !data) {
        throw new Error(`Failed to fetch booking: ${bookingErr?.message ?? 'not found'}`);
      }
      booking = data as BookingData;
    }

    const { data: location, error: locationErr } = await supabase
      .from('locations')
      .select('id, name, address, store_email')
      .eq('id', booking.location_id)
      .single();
    if (locationErr || !location) {
      throw new Error(`Failed to fetch location: ${locationErr?.message ?? 'not found'}`);
    }

    // A venue with no store email simply isn't set up for notifications yet —
    // that's expected, not a failure.
    if (!location.store_email) {
      console.log(`No store email configured for location: ${location.name}`);
      return json({ success: false, message: 'No store email configured' });
    }

    const { data: timeslot } = await supabase
      .from('timeslots')
      .select('id, name, start_time, end_time')
      .eq('id', booking.timeslot_id)
      .single();

    const { data: game } = booking.game_id
      ? await supabase.from('games').select('id, name').eq('id', booking.game_id).single()
      : { data: null };

    const bookingDate = formatBookingDate(booking.date);
    const startTime   = formatTime(timeslot?.start_time ?? null);
    const endTime     = formatTime(timeslot?.end_time ?? null);
    const slotName    = timeslot?.name ?? 'Timeslot';

    const { subject, html, text } = renderEmail({
      cancelled,
      booking,
      locationName: location.name,
      address:      location.address,
      bookingDate,
      slotName,
      startTime,
      endTime,
      gameName: game?.name ?? null,
    });

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
        to: [location.store_email],
        subject,
        html,
        text,
        // So the store can just hit reply and reach the customer.
        reply_to: booking.user_email,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend error (${res.status}): ${detail}`);
    }

    const result = await res.json();
    console.log(`Sent ${cancelled ? 'cancellation' : 'booking'} notification for ${booking.id} to ${location.store_email}`);
    return json({ success: true, email_id: result.id });

  } catch (error) {
    console.error('send-booking-notification failed:', error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
