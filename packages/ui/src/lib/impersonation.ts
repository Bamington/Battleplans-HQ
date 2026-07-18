/**
 * impersonation.ts — "view as" state for admins
 *
 * Lets an admin preview the platform as a beta tester or a regular user, to
 * check what each access level actually sees. It is a display lens only: the
 * admin keeps their own session and their own data, so every RLS policy still
 * evaluates against their real user. Only what the UI *shows* changes.
 *
 * Nothing here is a security boundary. my_platform_apps() re-checks that the
 * caller is really an admin before honouring the pretend role, and it can only
 * narrow the result. A non-admin setting this by hand gains nothing.
 *
 * Stored in sessionStorage rather than localStorage so it dies with the tab —
 * an admin can't leave themselves stuck in a downgraded view days later. It
 * rides the cross-app hand-off in supabase.ts so the lens survives switching
 * apps, which is the main thing worth testing.
 */

import { useSyncExternalStore } from 'react';

/** Roles an admin can preview. Deliberately excludes 'admin' — this only ever narrows. */
export type ImpersonatedRole = 'user' | 'beta_tester';

export const IMPERSONATION_STORAGE_KEY = 'bp_impersonate_role';

const listeners = new Set<() => void>();

function isValid(value: string | null): value is ImpersonatedRole {
  return value === 'user' || value === 'beta_tester';
}

/** The role currently being previewed, or null when viewing as yourself. */
export function getImpersonatedRole(): ImpersonatedRole | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(IMPERSONATION_STORAGE_KEY);
    return isValid(raw) ? raw : null;
  } catch {
    // Private-mode / storage disabled — behave as if not impersonating.
    return null;
  }
}

/** Start previewing as `role`, or pass null to return to your own view. */
export function setImpersonatedRole(role: ImpersonatedRole | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (role) window.sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, role);
    else window.sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the listeners below still fire so the UI stays
    // consistent with whatever getImpersonatedRole() now reports.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactive read of the previewed role. Re-renders when it changes. */
export function useImpersonatedRole(): ImpersonatedRole | null {
  return useSyncExternalStore(subscribe, getImpersonatedRole, () => null);
}
