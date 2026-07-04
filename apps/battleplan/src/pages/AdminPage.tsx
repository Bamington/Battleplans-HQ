import { AdminRoute, AdminToolsPage } from '@battleplans/ui';
import { APPS } from '../components/AppNavbar';

const BattlePlanLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattlePlan</span>
);

const LINKS = [
  { title: 'Manage Users', description: 'View all users and manage their roles.', href: '/app/admin/users' },
  { title: 'Manage Locations', description: 'Add and configure venues for table bookings.', href: '/app/admin/locations' },
  { title: 'Manage Games', description: 'Control which games are available for booking.', href: '/app/admin/games' },
];

export default function AdminPage() {
  return (
    <AdminRoute>
      <AdminToolsPage
        logo={<BattlePlanLogo />}
        apps={APPS}
        description="Manage locations, games, and other app-wide settings."
        links={LINKS}
      />
    </AdminRoute>
  );
}
