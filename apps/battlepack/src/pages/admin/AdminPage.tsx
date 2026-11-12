import { AdminRoute, AdminToolsPage } from '@battleplans/ui';
import { BattlePackLogo } from '../../components/AppNavbar.tsx';

const LINKS = [
  { title: 'Manage Users', description: 'View all users and manage their roles.', href: '/app/admin/users' },
  { title: 'Manage Updates', description: 'Write and publish News & Updates release notes.', href: '/app/admin/updates' },
];

export default function AdminPage() {
  return (
    <AdminRoute>
      <AdminToolsPage
        logo={<BattlePackLogo />}
        description="Manage users, release notes and other app-wide settings."
        links={LINKS}
      />
    </AdminRoute>
  );
}
