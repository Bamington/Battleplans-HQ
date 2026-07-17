import { AdminRoute, AdminToolsPage } from '@battleplans/ui';
import { APPS } from '../../components/AppNavbar';

const BattleBoxLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattleBox</span>
);

const LINKS = [
  { title: 'Paint Packs', description: 'Create and edit the paint packs users can add.', href: '/app/admin/paint-packs' },
];

export default function AdminPage() {
  return (
    <AdminRoute>
      <AdminToolsPage
        logo={<BattleBoxLogo />}
        apps={APPS}
        description="Manage paint packs and other app-wide settings."
        links={LINKS}
      />
    </AdminRoute>
  );
}
