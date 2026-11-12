import { AdminRoute, AdminToolsPage } from '@battleplans/ui';
import { BattlePackLogo } from '../../components/AppNavbar.tsx';

const LINKS = [
  { title: 'Manage Users', description: 'View all users and manage their roles.', href: '/app/admin/users' },
];

export default function AdminPage() {
  return (
    <AdminRoute>
      <AdminToolsPage
        logo={<BattlePackLogo />}
        description="Manage users and other app-wide settings."
        links={LINKS}
      />
    </AdminRoute>
  );
}
