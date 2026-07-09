import { useLocation, matchPath } from 'react-router-dom';
import { Navbar } from '@battleplans/ui';
import type { AppEntry, Breadcrumb } from '@battleplans/ui';

const APPS: AppEntry[] = [
  {
    name: 'BattleCards',
    href: 'https://battleplans-hq-battlecards-one.vercel.app/app',
    description: 'Build and manage unit cards',
  },
  {
    name: 'BattlePack',
    href: '#',
    description: 'Organise wargaming events',
  },
  {
    name: 'BattlePlan',
    href: '/',
    description: 'Find stores and book tables',
    active: true,
  },
  {
    name: 'BattleBox',
    href: '#',
    description: 'Track your miniature collection',
  },
];

export { APPS };

// ── Breadcrumbs ────────────────────────────────────────────────────────────
// One entry per screen. The trail's last crumb is the current page. Home is
// intentionally omitted from '/app' so the home screen shows no breadcrumb.

const HOME:  Breadcrumb = { label: 'Home',        href: '/app' };
const ADMIN: Breadcrumb = { label: 'Admin Tools', href: '/app/admin' };

const CRUMBS: { pattern: string; trail: Breadcrumb[] }[] = [
  { pattern: '/app/manage-store',    trail: [HOME, { label: 'Manage Store' }] },
  { pattern: '/app/admin',           trail: [HOME, { label: 'Admin Tools' }] },
  { pattern: '/app/admin/users',     trail: [HOME, ADMIN, { label: 'Manage Users' }] },
  { pattern: '/app/admin/locations', trail: [HOME, ADMIN, { label: 'Manage Locations' }] },
  { pattern: '/app/admin/games',     trail: [HOME, ADMIN, { label: 'Manage Games' }] },
];

function useBreadcrumbs(): Breadcrumb[] {
  const { pathname } = useLocation();
  for (const { pattern, trail } of CRUMBS) {
    if (matchPath({ path: pattern, end: true }, pathname)) return trail;
  }
  return [];
}

type NavbarProps = Parameters<typeof Navbar>[0];

export default function AppNavbar(props: Omit<NavbarProps, 'apps'>) {
  const crumbs = useBreadcrumbs();
  return <Navbar {...props} apps={APPS} breadcrumbs={props.breadcrumbs ?? crumbs} />;
}
