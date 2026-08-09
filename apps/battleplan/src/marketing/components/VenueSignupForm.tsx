/**
 * VenueSignupForm.tsx — The venue page's closing ask
 *
 * Replaces the two buttons that used to close this page. A form asks for more
 * than a button does, but it also answers the question the page has been
 * dodging: what actually happens when a shop owner says yes.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NOT CONNECTED YET.
 *
 * Nothing here submits anywhere. There's no endpoint, no table, no mailbox —
 * where a venue's details should go hasn't been decided, and inventing a
 * destination is not a decision to make quietly.
 *
 * So it deliberately does NOT show a success message. A form that says "thanks,
 * we'll be in touch" while dropping the details on the floor is worse than one
 * that plainly says it isn't finished: the first loses real venues silently,
 * the second only looks unfinished. It stays this way until there's somewhere
 * real to send it.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';

const ROLES = ['Owner', 'Manager', 'Team Member', 'Other'] as const;

export function VenueSignupForm() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className="mk-form"
      noValidate={false}
      onSubmit={e => {
        e.preventDefault();
        setSubmitted(true);
      }}
    >
      <div className="mk-form-grid">
        <label className="mk-field">
          <span className="mk-field-label">Your name</span>
          <input className="mk-input" name="name" type="text" autoComplete="name" required />
        </label>

        <label className="mk-field">
          <span className="mk-field-label">Email</span>
          <input className="mk-input" name="email" type="email" autoComplete="email" required />
        </label>

        <label className="mk-field">
          <span className="mk-field-label">Store or club name</span>
          <input className="mk-input" name="venue" type="text" autoComplete="organization" required />
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

      <button type="submit" className="mk-btn mk-btn-primary mt-6">List your venue</button>

      {submitted && (
        <p className="mk-form-notice" role="status">
          <strong>Not connected yet.</strong> This form has no destination — nothing
          was sent and nothing was stored. Wire it up before the page goes live.
        </p>
      )}
    </form>
  );
}
