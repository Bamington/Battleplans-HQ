import { AdminRoute, ManageUpdatesPage } from '@battleplans/ui';

const BattleBenchLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattleBench</span>
);

export default function ManageUpdates() {
  return (
    <AdminRoute>
      <ManageUpdatesPage logo={<BattleBenchLogo />} />
    </AdminRoute>
  );
}
