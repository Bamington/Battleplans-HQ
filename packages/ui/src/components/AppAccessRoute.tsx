/**
 * AppAccessRoute — gates a whole app behind the user's platform access level.
 *
 * Hiding an app in the switcher is only cosmetic: each app is a separate origin
 * with its own URL, so anyone who has been sent a link or has one bookmarked can
 * still load it. This wraps the app's protected routes and turns that into a
 * proper "not yet" screen, offering the apps they *can* open instead.
 *
 * Expects setCurrentApp() to have run at startup. Wrap inside ProtectedRoute —
 * access can't be resolved until there's a session.
 *
 * USAGE:
 *   <ProtectedRoute>
 *     <AppAccessRoute>
 *       <Outlet />
 *     </AppAccessRoute>
 *   </ProtectedRoute>
 */

import { usePlatformApps } from '../hooks/usePlatformApps';
import { getCurrentApp } from '../lib/currentApp';
import { appendSessionToUrl } from '../lib/supabase';
import Button from './Button';
import Lock from '../icons/Lock';

interface Props {
  children: React.ReactNode;
  /** App name shown in the no-access message. Defaults to the registered slug. */
  appName?: string;
}

export default function AppAccessRoute({ children, appName }: Props) {
  const { apps, loading, hasAccess } = usePlatformApps();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="font-body text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (hasAccess) return <>{children}</>;

  const name = appName ?? getCurrentApp() ?? 'This app';
  const elsewhere = apps.filter((a) => a.href !== '#' && !a.active);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6">
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center">
          <Lock className="w-5 h-5 text-gray-500" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="font-body text-lg font-semibold text-gray-200">
            {name} isn’t available yet
          </h1>
          <p className="font-body text-sm text-gray-400">
            Your account doesn’t have access to this app right now. It’ll open up
            as we roll more of the platform out.
          </p>
        </div>

        {elsewhere.length > 0 && (
          <div className="w-full flex flex-col gap-2 pt-2">
            <p className="font-body text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Available to you
            </p>
            {elsewhere.map((app) => (
              <Button
                key={app.slug ?? app.name}
                color="primary"
                variant="outline"
                onClick={async () => {
                  window.location.href = await appendSessionToUrl(app.href);
                }}
              >
                {app.name}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
