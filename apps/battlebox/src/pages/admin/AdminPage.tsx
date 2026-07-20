import { AdminRoute, AdminToolsPage } from '@battleplans/ui';

const BattleBenchLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattleBench</span>
);

const LINKS = [
  { title: 'Paint Packs', description: 'Create and edit the paint packs users can add.', href: '/app/admin/paint-packs' },
];

export default function AdminPage() {
  return (
    <AdminRoute>
      <AdminToolsPage
        logo={<BattleBenchLogo />}
        description="Manage paint packs and other app-wide settings."
        links={LINKS}
      />
    </AdminRoute>
  );
}
