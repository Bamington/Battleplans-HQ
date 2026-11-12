import { AdminRoute, ManageUsersPage } from '@battleplans/ui';

const BattleBenchLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattleBench</span>
);

export default function ManageUsers() {
  return (
    <AdminRoute>
      <ManageUsersPage logo={<BattleBenchLogo />} />
    </AdminRoute>
  );
}
