import { useLocation, matchPath } from 'react-router-dom';
import { Navbar } from '@battleplans/ui';
import type { Breadcrumb } from '@battleplans/ui';

// The platform switcher's app list is not defined here — Navbar loads the apps
// this user may access from the database (see supabase/migrations/
// 20260719120000_platform_access.sql).

// ── Breadcrumbs ────────────────────────────────────────────────────────────
// One entry per screen. The trail's last crumb is the current page. Home is
// intentionally omitted from '/app' so the home screen shows no breadcrumb.

const HOME: Breadcrumb = { label: 'Home', href: '/app' };

const CRUMBS: { pattern: string; trail: Breadcrumb[] }[] = [
  { pattern: '/app/:packId/edit', trail: [HOME, { label: 'Edit Pack' }] },
];

function useBreadcrumbs(): Breadcrumb[] {
  const { pathname } = useLocation();
  for (const { pattern, trail } of CRUMBS) {
    if (matchPath({ path: pattern, end: true }, pathname)) return trail;
  }
  return [];
}

/** The wordmark in the navbar's top-left. Exported so Login can use it too. */
export const BattlePackLogo = () => (
  <span className="font-heading text-white text-base tracking-wide">BattlePack</span>
);

type NavbarProps = Parameters<typeof Navbar>[0];

export default function AppNavbar(props: Omit<NavbarProps, 'apps'>) {
  const crumbs = useBreadcrumbs();
  return (
    <Navbar
      {...props}
      logo={props.logo ?? <BattlePackLogo />}
      breadcrumbs={props.breadcrumbs ?? crumbs}
    />
  );
}
