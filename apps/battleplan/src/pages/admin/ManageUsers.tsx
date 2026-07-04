import { AdminRoute, ManageUsersPage } from '@battleplans/ui';
import { APPS } from '../../components/AppNavbar';

const BattlePlanLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattlePlan</span>
);

export default function ManageUsers() {
  return (
    <AdminRoute>
      <ManageUsersPage logo={<BattlePlanLogo />} apps={APPS} />
    </AdminRoute>
  );
}
