import { useLocation, matchPath } from 'react-router-dom';
import { Navbar } from '@battleplans/ui';
import type { AppEntry, Breadcrumb } from '@battleplans/ui';

const APPS: AppEntry[] = [
  {
    name: 'BattleCards',
    href: '/',
    description: 'Build and manage unit cards',
    active: true,
  },
  {
    name: 'BattlePack',
    href: '#',
    description: 'Organise wargaming events',
  },
  {
    name: 'BattlePlan',
    href: 'https://battleplans-hq-battleplan-xi.vercel.app/app',
    description: 'Find stores and book tables',
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
const PACKS: Breadcrumb = { label: 'Packs',       href: '/app/packs' };
const RYG:   Breadcrumb = { label: 'Repent Ye Foolish Gods', href: '/app/builder/ryg' };

const CRUMBS: { pattern: string; trail: Breadcrumb[] }[] = [
  { pattern: '/app/admin',                trail: [HOME, { label: 'Admin Tools' }] },
  { pattern: '/app/admin/users',          trail: [HOME, ADMIN, { label: 'Manage Users' }] },
  { pattern: '/app/admin/games',          trail: [HOME, ADMIN, { label: 'Manage Games' }] },
  { pattern: '/app/admin/packs',          trail: [HOME, ADMIN, { label: 'Manage Packs' }] },
  { pattern: '/app/packs',                trail: [HOME, { label: 'Packs' }] },
  { pattern: '/app/packs/new',            trail: [HOME, PACKS, { label: 'New Pack' }] },
  { pattern: '/app/packs/:packId/edit',   trail: [HOME, PACKS, { label: 'Edit Pack' }] },
  { pattern: '/app/builder/blood-bowl',      trail: [HOME, { label: 'Blood Bowl' }] },
  { pattern: '/app/builder/halo-flashpoint', trail: [HOME, { label: 'Halo: Flashpoint' }] },
  { pattern: '/app/builder/kill-team',       trail: [HOME, { label: 'Kill Team' }] },
  { pattern: '/app/builder/starcraft',       trail: [HOME, { label: 'StarCraft' }] },
  { pattern: '/app/builder/ryg',          trail: [HOME, { label: 'Repent Ye Foolish Gods' }] },
  { pattern: '/app/builder/ryg-sept',     trail: [HOME, RYG, { label: 'Septs' }] },
  { pattern: '/app/builder/ryg-god',      trail: [HOME, RYG, { label: 'Gods' }] },
  { pattern: '/app/print',                trail: [HOME, { label: 'Print' }] },
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
