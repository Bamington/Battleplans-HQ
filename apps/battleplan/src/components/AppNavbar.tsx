import { useLocation, matchPath } from 'react-router-dom';
import { Navbar } from '@battleplans/ui';
import type { Breadcrumb } from '@battleplans/ui';

// The platform switcher's app list is no longer defined here — Navbar loads the
// apps this user may access from the database (see supabase/migrations/
// 20260719120000_platform_access.sql).

// ── Breadcrumbs ────────────────────────────────────────────────────────────
// One entry per screen. The trail's last crumb is the current page. Home is
// intentionally omitted from '/app' so the home screen shows no breadcrumb.

const HOME:  Breadcrumb = { label: 'Home',        href: '/app' };
const ADMIN: Breadcrumb = { label: 'Admin Tools', href: '/app/admin' };

const CRUMBS: { pattern: string; trail: Breadcrumb[] }[] = [
  { pattern: '/app/stats',           trail: [HOME, { label: 'Battle Stats' }] },
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
  return <Navbar {...props} breadcrumbs={props.breadcrumbs ?? crumbs} />;
}
