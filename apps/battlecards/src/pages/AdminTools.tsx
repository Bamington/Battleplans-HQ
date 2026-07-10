import { AdminToolsPage } from '@battleplans/ui';

const LINKS = [
  { title: 'Manage Users', description: 'View all users and manage their roles.', href: '/app/admin/users' },
  { title: 'Manage Games', description: 'Control which games are visible and to whom.', href: '/app/admin/games' },
  { title: 'Manage Packs', description: 'Review and manage published content packs.', href: '/app/admin/packs' },
  { title: 'Manage Updates', description: 'Write and publish News & Updates release notes.', href: '/app/admin/updates' },
];

export default function AdminTools() {
  return (
    <AdminToolsPage
      description="Manage games, packs, and other app-wide settings."
      links={LINKS}
    />
  );
}
