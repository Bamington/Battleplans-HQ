import { AdminRoute, ManageUsersPage } from '@battleplans/ui';

const BattlePlanLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattlePlan</span>
);

export default function ManageUsers() {
  return (
    <AdminRoute>
      <ManageUsersPage logo={<BattlePlanLogo />} />
    </AdminRoute>
  );
}
