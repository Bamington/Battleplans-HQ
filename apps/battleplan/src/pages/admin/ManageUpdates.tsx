import { AdminRoute, ManageUpdatesPage } from '@battleplans/ui';
import { APPS } from '../../components/AppNavbar';

const BattlePlanLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattlePlan</span>
);

export default function ManageUpdates() {
  return (
    <AdminRoute>
      <ManageUpdatesPage logo={<BattlePlanLogo />} apps={APPS} />
    </AdminRoute>
  );
}
