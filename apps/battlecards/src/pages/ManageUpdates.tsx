import { AdminRoute, ManageUpdatesPage } from '@battleplans/ui';
import { APPS } from '../components/AppNavbar';

export default function ManageUpdates() {
  return (
    <AdminRoute>
      <ManageUpdatesPage apps={APPS} />
    </AdminRoute>
  );
}
