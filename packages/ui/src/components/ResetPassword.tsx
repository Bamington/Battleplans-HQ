import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Input from './Input';
import Button from './Button';

/**
 * ResetPassword.tsx — the page a password-reset email actually lands on.
 *
 * Reset links used to point at /auth/callback, which sends anyone with a
 * session straight to /app — so the link "worked" while never giving the user
 * a chance to set a new password. This is that missing step.
 *
 * Supabase signs the user in as it processes the recovery link, so by the time
 * this renders there is a real session; updateUser() then sets the password on
 * it. Each app routes to this at /auth/reset-password and passes its own
 * background so the page matches the app the user came from.
 *
 * Route: /auth/reset-password
 */

// A recovery link that Supabase can't process leaves us waiting forever, so
// give up after this and tell the user to request a new one.
const SESSION_WAIT_MS = 8000;

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="7.333" width="10" height="7.334" rx="1.333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.333 7.333V5.333a2.667 2.667 0 0 1 5.334 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface Props {
  /** Page background, so the page matches the app it's rendered in. */
  className?: string;
  /** Where to send the user once the password is changed. */
  redirectTo?: string;
}

export default function ResetPassword({ className = 'bg-gray-950', redirectTo = '/app' }: Props) {
  const navigate = useNavigate();

  const [ready,    setReady]    = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    let settled = false;

    // Fires immediately with INITIAL_SESSION once the client has finished
    // processing the recovery link, then again with PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !settled) {
        settled = true;
        setReady(true);
      }
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setReady(false);
      }
    }, SESSION_WAIT_MS);

    return () => {
      settled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      navigate(redirectTo, { replace: true });
    }
  }

  const card = 'bg-neutral-800 border border-neutral-700 rounded-lg shadow-md w-full md:w-[450px] p-5 flex flex-col gap-4';

  if (ready === null) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${className}`}>
        <p className="font-body text-sm text-neutral-400">Checking your reset link…</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-3 ${className}`}>
        <div className={card}>
          <h1 className="font-heading text-white text-[19.8px] leading-7">Link expired</h1>
          <p className="font-body text-base text-neutral-300 leading-6">
            This password reset link is no longer valid. Request a new one from the
            sign-in page.
          </p>
          <Button className="w-full" variant="outline" color="secondary" type="button" onClick={() => navigate('/login')}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-3 ${className}`}>
      <form className={card} onSubmit={handleSubmit}>

        <h1 className="font-heading text-white text-[19.8px] leading-7">Choose a new password</h1>

        <Input
          label="New password"
          type="password"
          placeholder="••••••••"
          leftIcon={<LockIcon />}
          value={password}
          onChange={e => setPassword(e.target.value)}
          state={error ? 'error' : 'default'}
          autoComplete="new-password"
          required
        />

        <Input
          label="Confirm new password"
          type="password"
          placeholder="••••••••"
          leftIcon={<LockIcon />}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          state={error ? 'error' : 'default'}
          helperText={error ?? undefined}
          autoComplete="new-password"
          required
        />

        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save new password'}
        </Button>

      </form>
    </div>
  );
}
