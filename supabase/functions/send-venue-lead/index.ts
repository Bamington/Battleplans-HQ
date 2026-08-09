/**
 * send-venue-lead — emails the platform owner when a venue signs up on /venue.
 *
 * Called by the `venue_leads_notify` Postgres trigger, never by a browser. It
 * follows send-booking-notification's shape deliberately, including the shared
 * secret and the read-back:
 *
 *   * The payload is a bare `{ lead_id }`. Everything in the email is read from
 *     the row with the service role, so knowing the URL and the secret still
 *     doesn't let anyone dictate what the email says.
 *
 *   * Every value is HTML-escaped. This is a public, unauthenticated form —
 *     the venue name is whatever a stranger typed into a box.
 *
 *   * It reuses BOOKING_WEBHOOK_SECRET. Edge function secrets are per-project,
 *     not per-function, so it's already set; the gate is the same gate.
 *
 * Env (set with `supabase secrets set` — never committed):
 *   RESEND_API_KEY          Resend key
 *   FROM_EMAIL              a sender on the verified domain
 *   BOOKING_WEBHOOK_SECRET  shared with the Postgres trigger
 *   VENUE_LEAD_TO           optional; where leads go, defaults below
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Overridable without a redeploy, but it needs to work without being set. */
const DEFAULT_TO = 'chris.bam.harrison@gmail.com';

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

interface Lead {
  id:           string;
  created_at:   string;
  contact_name: string;
  email:        string;
  venue_name:   string;
  role:         string;
}

function renderEmail(lead: Lead): { subject: string; html: string; text: string } {
  const rows: [string, string][] = [
    ['Venue',   lead.venue_name],
    ['Contact', lead.contact_name],
    ['Role',    lead.role],
    ['Email',   lead.email],
  ];

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
        .footer { margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px; font-size: 12px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏪 New venue signup</h1>
            <p>${esc(lead.venue_name)} wants to list on BattlePlan</p>
        </div>

        <div class="content">
            <div class="details">
${rows.map(([label, value]) => `                <div class="detail-row">
                    <span class="detail-label">${esc(label)}:</span>
                    <span class="detail-value">${esc(value)}</span>
                </div>`).join('\n')}
            </div>

            <p>Reply to this email to reach ${esc(lead.contact_name)} directly.</p>
        </div>

        <div class="footer">
            <p>Submitted through the form at battleplan.app/venue. Lead #${esc(String(lead.id).slice(0, 8))}.</p>
        </div>
    </div>
</body>
</html>
  `;

  const text = `New venue signup — ${lead.venue_name}

${rows.map(([label, value]) => `- ${label}: ${value}`).join('\n')}

Reply to this email to reach ${lead.contact_name} directly.
Submitted through the form at battleplan.app/venue. Lead #${String(lead.id).slice(0, 8)}.`;

  return { subject: `New venue signup: ${lead.venue_name}`, html, text };
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

    const { lead_id } = await req.json().catch(() => ({}));
    if (!lead_id) return json({ success: false, error: 'lead_id is required' }, 400);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase
      .from('venue_leads')
      .select('id, created_at, contact_name, email, venue_name, role')
      .eq('id', lead_id)
      .single();
    if (error || !data) throw new Error(`Failed to fetch lead: ${error?.message ?? 'not found'}`);

    const lead = data as Lead;
    const { subject, html, text } = renderEmail(lead);

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
        to: [Deno.env.get('VENUE_LEAD_TO') ?? DEFAULT_TO],
        subject,
        html,
        text,
        // So replying goes to the venue rather than to a noreply address.
        reply_to: lead.email,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend error (${res.status}): ${detail}`);
    }

    const result = await res.json();
    console.log(`Sent venue lead notification for ${lead.id} (${lead.venue_name})`);
    return json({ success: true, email_id: result.id });

  } catch (error) {
    console.error('send-venue-lead failed:', error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
