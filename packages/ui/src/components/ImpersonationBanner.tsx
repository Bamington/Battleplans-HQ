/**
 * ImpersonationBanner — persistent reminder that you're viewing as someone else.
 *
 * Renders nothing unless an admin is previewing a lower access level. Pinned to
 * the bottom of the viewport so it survives whatever the page is doing, and
 * rendered by both Navbar and AppAccessRoute: previewing a role that can't open
 * the current app replaces the whole page, Navbar included, so the way out has
 * to exist on that screen too.
 */

import { useEffectiveRole } from '../hooks/useEffectiveRole';
import { setImpersonatedRole } from '../lib/impersonation';
import Eye from '../icons/Eye';

const ROLE_LABEL: Record<string, string> = {
  user: 'Regular User',
  beta_tester: 'Beta Tester',
};

export default function ImpersonationBanner() {
  const { effectiveRole, isImpersonating } = useEffectiveRole();

  if (!isImpersonating) return null;

  return (
    <div
      role="status"
      className="fixed bottom-0 left-0 right-0 z-50 bg-warning-950 border-t border-warning-800"
    >
      <div className="px-3 py-2 flex items-center justify-center gap-3">
        <Eye className="w-4 h-4 text-warning-500 shrink-0" />
        <p className="font-body text-sm text-warning-200 min-w-0 truncate">
          Viewing as{' '}
          <span className="font-semibold">
            {ROLE_LABEL[effectiveRole ?? ''] ?? effectiveRole}
          </span>
          <span className="hidden sm:inline text-warning-400"> — your own access is unchanged</span>
        </p>
        <button
          type="button"
          onClick={() => setImpersonatedRole(null)}
          className="shrink-0 font-body text-sm font-semibold text-warning-100 underline
                     underline-offset-2 hover:text-white transition-colors cursor-pointer"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
