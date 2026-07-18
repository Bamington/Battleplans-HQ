import { useEffectiveRole } from './useEffectiveRole';

/**
 * Whether the UI should treat this user as an admin.
 *
 * False while an admin is previewing a lower access level, so admin-only menus
 * and routes disappear for the duration — otherwise "view as a regular user"
 * would still show Admin Tools, which no regular user has. Server-side checks
 * are unaffected: the admin's real identity still backs every RLS policy and
 * security-definer RPC.
 */
export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const { effectiveRole, loading } = useEffectiveRole();
  return { isAdmin: effectiveRole === 'admin', loading };
}
