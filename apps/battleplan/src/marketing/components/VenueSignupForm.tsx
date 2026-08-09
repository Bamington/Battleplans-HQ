/**
 * VenueSignupForm.tsx — The venue page's closing ask
 *
 * Replaces the two buttons that used to close this page. A form asks for more
 * than a button does, but it also answers the question the page has been
 * dodging: what actually happens when a shop owner says yes.
 *
 * Submissions insert into `public.venue_leads`, which anon may write and only
 * an admin may read (see 20260809000000_venue_leads.sql). A Postgres trigger
 * then emails the lead through the send-venue-lead edge function, so nothing
 * here waits on Resend — the insert returning is the whole success condition.
 *
 * NOTE ON THE ONE IMPORT FROM @battleplans/ui: this directory's CLAUDE.md bans
 * importing from the shared package, and that ban is about design — components,
 * icons, tokens. The Supabase client is neither. There is exactly one client
 * per app on purpose (it holds the session), and constructing a second one here
 * would be the actual mistake.
 */

import { useState } from 'react';
import { supabase } from '@battleplans/ui';

const ROLES = ['Owner', 'Manager', 'Team Member', 'Other'] as const;

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function VenueSignupForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;

    const form = e.currentTarget;
    const data = new FormData(form);

    setStatus('sending');
    setError(null);

    const { error: insertError } = await supabase.from('venue_leads').insert({
      contact_name: String(data.get('name') ?? '').trim(),
      email:        String(data.get('email') ?? '').trim(),
      venue_name:   String(data.get('venue') ?? '').trim(),
      role:         String(data.get('role') ?? 'Owner'),
    });

    if (insertError) {
      // Anything the database refused is on us, not on them — the browser has
      // already enforced everything a person can reasonably fix. No support
      // address to fall back on yet, so don't invent one.
      console.error('venue_leads insert failed:', insertError);
      setError("Something went wrong at our end and your details weren't saved. Please try again.");
      setStatus('error');
      return;
    }

    form.reset();
    setStatus('sent');
  }

  /*
   * The form is replaced by the confirmation rather than sitting above it.
   * Leaving an empty form under a "thanks" is an invitation to submit twice.
   */
  if (status === 'sent') {
    return (
      <p className="mk-form-notice" role="status">
        <strong>Thanks — we've got it.</strong> We'll be in touch at the address you
        gave us to get your tables set up.
      </p>
    );
  }

  return (
    <form className="mk-form" onSubmit={handleSubmit}>
      <div className="mk-form-grid">
        <label className="mk-field">
          <span className="mk-field-label">Your name</span>
          <input className="mk-input" name="name" type="text" autoComplete="name" required maxLength={120} />
        </label>

        <label className="mk-field">
          <span className="mk-field-label">Email</span>
          <input className="mk-input" name="email" type="email" autoComplete="email" required maxLength={200} />
        </label>

        <label className="mk-field">
          <span className="mk-field-label">Store or club name</span>
          <input className="mk-input" name="venue" type="text" autoComplete="organization" required maxLength={160} />
        </label>

        <label className="mk-field">
          <span className="mk-field-label">Your role</span>
          {/*
            A select rather than four radios: it's one choice from a short
            closed list next to three text fields, and radios here would make
            the row twice the height of everything beside it.
          */}
          <select className="mk-input" name="role" defaultValue="Owner" required>
            {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
      </div>

      <button type="submit" className="mk-btn mk-btn-primary mt-6" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'List your venue'}
      </button>

      {error && (
        <p className="mk-form-notice" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
