/**
 * ManageUsers.tsx — the shared Manage Users page, under BattleCards' chrome.
 *
 * BattleCards used to carry its own older copy (roles only — no @username,
 * real name, location admins or search). Every app now uses the one in
 * @battleplans/ui, so a fix made there lands everywhere.
 */
import { ManageUsersPage } from '@battleplans/ui';

export default function ManageUsers() {
  return <ManageUsersPage />;
}
