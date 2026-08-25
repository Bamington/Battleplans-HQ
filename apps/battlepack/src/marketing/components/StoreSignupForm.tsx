/**
 * StoreSignupForm.tsx — the /stores page's closing ask
 *
 * BattlePack is not self-serve and the page must not pretend otherwise. Access
 * is platform admins plus store admins AT VENUES IT HAS BEEN SWITCHED ON FOR —
 * two tables that both have to say yes, so the app rolls out a shop at a time
 * (see the app's CLAUDE.md). A "create your account" button here would send a
 * shop owner straight into the access gate. Getting switched on is a
 * conversation, so the page ends on the form that starts one.
 *
 * Submissions insert into `public.venue_leads` with `app: 'battlepack'`, which
 * is the same table and the same Postgres trigger BattlePlan's /venue form
 * writes to — one inbox, one edge function, one column saying which door the
 * lead came through. See 20260825000000_battlepack_marketing.sql.
 *
 * NOTE ON THE IMPORT FROM @battleplans/ui: this directory does not use the
 * app's design system, and the shared marketing package deliberately knows
 * nothing about Supabase. The client is neither a design asset nor part of the
 * design system — there is exactly one per app on purpose, because it holds the
 * session, and constructing a second one here would be the actual mistake.
 */

import { useState } from 'react';
import { supabase } from '@battleplans/ui';

const ROLES = ['Owner', 'Manager', 'Team Member', 'Other'] as const;

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function StoreSignupForm() {
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
      app:          'battlepack',
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
        gave us to get BattlePack switched on for your venue.
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
        {status === 'sending' ? 'Sending…' : 'Ask about your venue'}
      </button>

      {error && (
        <p className="mk-form-notice" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
