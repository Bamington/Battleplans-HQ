import { AdminRoute, AdminToolsPage } from '@battleplans/ui';

const BattleBenchLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattleBench</span>
);

const LINKS = [
  { title: 'Manage Users', description: 'View all users and manage their roles.', href: '/app/admin/users' },
  { title: 'Paint Packs', description: 'Create and edit the paint packs users can add.', href: '/app/admin/paint-packs' },
  { title: 'Box Contents', description: 'Check and correct what “Suggest contents” finds in each box.', href: '/app/admin/box-contents' },
];

export default function AdminPage() {
  return (
    <AdminRoute>
      <AdminToolsPage
        logo={<BattleBenchLogo />}
        description="Manage users, paint packs, box contents and other app-wide settings."
        links={LINKS}
      />
    </AdminRoute>
  );
}
