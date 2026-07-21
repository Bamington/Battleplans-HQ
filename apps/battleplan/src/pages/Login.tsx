import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, authRedirectTo, Input, Button, Checkbox } from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;

// ── Icons ─────────────────────────────────────────────────────────────────────

const EmailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="3.333" width="12" height="9.334" rx="1.333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 5.333 8 9.333l6-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="7.333" width="10" height="7.334" rx="1.333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.333 7.333V5.333a2.667 2.667 0 0 1 5.334 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const BattlePlanLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattlePlan</span>
);

// ── Page ──────────────────────────────────────────────────────────────────────

type Mode = 'signin' | 'signup';

export default function Login() {
  const navigate = useNavigate();

  const [mode,            setMode]            = useState<Mode>('signin');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [success,         setSuccess]         = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSuccess(null);
    setPassword('');
    setConfirmPassword('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        navigate('/app');
      }
    } else {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        // Without this the confirmation link uses the project's single Site
        // URL, so signing up here would mail you a link into a different app.
        options: { emailRedirectTo: authRedirectTo() },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Account created! Check your email to confirm before signing in.');
      }
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectTo() },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.MouseEvent) {
    e.preventDefault();
    if (!email) {
      setError('Enter your email address above, then click "Lost password?".');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectTo('/auth/reset-password'),
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setError('Password reset email sent — check your inbox.');
    }
  }

  const isSignIn = mode === 'signin';

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">

      <AppNavbar fixed={false} logo={<BattlePlanLogo />} />

      <div className="flex-1 flex flex-col items-center justify-center gap-2.5 p-3">

        <div className="flex-1 flex items-center justify-center w-full">

          <div className="bg-neutral-800 border border-neutral-700 rounded-lg shadow-md flex flex-col md:flex-row overflow-hidden w-full md:w-auto">

            {/* ── Left column: Auth form ── */}
            {success ? (

              <div className="w-full md:w-[450px] p-5 flex flex-col gap-4 justify-center">
                <h1 className="font-heading text-white text-[19.8px] leading-7">
                  Check your email
                </h1>
                <p className="font-body text-base text-neutral-300 leading-6">{success}</p>
                <Button className="w-full" variant="outline" color="secondary" type="button" onClick={() => switchMode('signin')}>
                  Back to sign in
                </Button>
              </div>

            ) : (

              <form className="w-full md:w-[450px] p-5 flex flex-col gap-4" onSubmit={handleSubmit}>

                <h1 className="font-heading text-white text-[19.8px] leading-7">
                  {isSignIn ? 'Sign in to BattlePlan' : 'Create your account'}
                </h1>

                <Input
                  label="Email"
                  type="email"
                  placeholder="name@battleplan.app"
                  leftIcon={<EmailIcon />}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  state={error ? 'error' : 'default'}
                  required
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  leftIcon={<LockIcon />}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  state={error ? 'error' : 'default'}
                  helperText={isSignIn && error ? error : undefined}
                  required
                />

                {!isSignIn && (
                  <Input
                    label="Confirm password"
                    type="password"
                    placeholder="••••••••"
                    leftIcon={<LockIcon />}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    state={error ? 'error' : 'default'}
                    helperText={error ?? undefined}
                    required
                  />
                )}

                {isSignIn && (
                  <div className="flex items-center justify-between w-full">
                    <Checkbox label="Remember me" />
                    <a
                      href="#"
                      className="font-body font-medium text-base text-primary-400 underline"
                      onClick={handleForgotPassword}
                    >
                      Lost password?
                    </a>
                  </div>
                )}

                <Button className="w-full" type="submit" disabled={loading}>
                  {loading
                    ? (isSignIn ? 'Signing in…' : 'Creating account…')
                    : (isSignIn ? 'Sign in'    : 'Create account')}
                </Button>

                <Button
                  className="w-full"
                  variant="outline"
                  color="secondary"
                  type="button"
                  leftIcon={<GoogleIcon />}
                  disabled={loading}
                  onClick={handleGoogleSignIn}
                >
                  Continue with Google
                </Button>

                <p className="font-body text-sm text-center text-neutral-300">
                  {isSignIn ? (
                    <>
                      No account?{' '}
                      <a href="#" className="font-medium text-primary-400 underline" onClick={e => { e.preventDefault(); switchMode('signup'); }}>
                        Create one
                      </a>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <a href="#" className="font-medium text-primary-400 underline" onClick={e => { e.preventDefault(); switchMode('signin'); }}>
                        Sign in
                      </a>
                    </>
                  )}
                </p>

              </form>

            )}

          </div>
        </div>

        {/* ── Version footer ── */}
        <div className="shrink-0 flex items-center gap-3 font-body font-bold text-xs text-neutral-800 tracking-[1.2px] uppercase">
          <div className="flex items-center gap-1">
            <span>BattlePlan version</span>
            <span>{__APP_VERSION__}</span>
          </div>
          <span>–</span>
          <div className="flex items-center gap-1">
            <span>Build date</span>
            <span>{__APP_BUILD_DATE__}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
