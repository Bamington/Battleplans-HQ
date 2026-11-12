import { AdminRoute, ManageUsersPage } from '@battleplans/ui';
import { BattlePackLogo } from '../../components/AppNavbar.tsx';

export default function ManageUsers() {
  return (
    <AdminRoute>
      <ManageUsersPage logo={<BattlePackLogo />} />
    </AdminRoute>
  );
}
