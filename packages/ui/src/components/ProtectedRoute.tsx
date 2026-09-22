import { Navigate } from 'react-router-dom';
import { useAuthStatus } from '../hooks/useAuthStatus';

interface Props {
  children: React.ReactNode;
}

/**
 * Route guard for authenticated-only pages.
 *
 * Renders its children when there is a usable session, and sends the user to
 * /login only when there is NO session on this device at all. The case in
 * between — a session in storage that cannot be refreshed because the server
 * is unreachable — is not a reason to ask for a password, and treating it as
 * one is what had people signing in every few days. See useAuthStatus for the
 * evidence. That state waits, retrying, and says so.
 */
export default function ProtectedRoute({ children }: Props) {
  const status = useAuthStatus();

  if (status === 'checking' || status === 'unreachable') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-gray-950 px-6 text-center">
        <p className="font-body text-sm text-gray-400">
          {status === 'unreachable' ? 'Reconnecting…' : 'Loading…'}
        </p>
        {status === 'unreachable' && (
          <p className="font-body text-xs text-gray-500 max-w-xs">
            You are still signed in — the server just cannot be reached right now.
            This will carry on by itself when the connection comes back.
          </p>
        )}
      </div>
    );
  }

  if (status === 'signed-out') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
