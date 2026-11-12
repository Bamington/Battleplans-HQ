import { AdminRoute, ManageUpdatesPage } from '@battleplans/ui';
import { BattlePackLogo } from '../../components/AppNavbar.tsx';

export default function ManageUpdates() {
  return (
    <AdminRoute>
      <ManageUpdatesPage logo={<BattlePackLogo />} />
    </AdminRoute>
  );
}
