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
    href: 'https://battleplans-hq-battleplan-xi.vercel.app/app',
    description: 'Find stores and book tables',
  },
  {
    name: 'BattleBox',
    href: '/',
    description: 'Track your miniature collection',
    active: true,
  },
];

export { APPS };

// ── Breadcrumbs ────────────────────────────────────────────────────────────
// One entry per screen. The trail's last crumb is the current page. Home is
// intentionally omitted from '/app' so the home screen shows no breadcrumb.

const CRUMBS: { pattern: string; trail: Breadcrumb[] }[] = [];

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
