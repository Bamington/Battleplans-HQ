import { useState } from 'react';
import { useLocation, useNavigate, matchPath } from 'react-router-dom';
import { Navbar, DropdownItem, Pen2, MapPin, UsersGroupRounded, profilePath } from '@battleplans/ui';
import EditLocationProfileModal, { type EditableLocationProfile } from './EditLocationProfileModal';
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
  { pattern: '/app/store-stats',     trail: [HOME, { label: 'Store Stats' }] },
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

interface AppNavbarProps extends Omit<NavbarProps, 'apps' | 'userMenuItems'> {
  /**
   * The venue or club picked in the "Viewing" selector, if any. Adds its
   * profile to the user menu: View for anyone attached to it, Edit for its
   * admins only (staff can't change venue settings anywhere else either).
   */
  venue?: (EditableLocationProfile & { role?: 'admin' | 'staff' }) | null;
  /** After the venue's profile is saved, so the page can refresh its copy. */
  onVenueSaved?: (updated: EditableLocationProfile) => void;
}

export default function AppNavbar({ venue, onVenueSaved, ...props }: AppNavbarProps) {
  const crumbs = useBreadcrumbs();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  // "Store" rather than "Venue" here: it's the word a shop owner uses for
  // their own business. A club is a club.
  const noun = venue?.kind === 'club' ? 'Club' : 'Store';
  const ViewIcon = venue?.kind === 'club' ? UsersGroupRounded : MapPin;

  const venueItems = venue && venue.kind !== 'space' ? (
    <>
      {venue.role === 'admin' && (
        <DropdownItem icon={<Pen2 className="w-4 h-4 text-gray-400" />} onClick={() => setEditing(true)}>
          <span className="text-gray-200">Edit {noun} Profile</span>
        </DropdownItem>
      )}
      {venue.slug && (
        <DropdownItem icon={<ViewIcon className="w-4 h-4 text-gray-400" />} onClick={() => navigate(profilePath(venue.slug!))}>
          <span className="text-gray-200">View {noun} Profile</span>
        </DropdownItem>
      )}
    </>
  ) : null;
  // Staff of a venue with no slug would get an empty section — show none.
  const hasItems = !!venue && venue.kind !== 'space' && (venue.role === 'admin' || !!venue.slug);

  return (
    <>
      <Navbar {...props} breadcrumbs={props.breadcrumbs ?? crumbs} userMenuItems={hasItems ? venueItems : undefined} />
      {venue && venue.role === 'admin' && (
        <EditLocationProfileModal
          open={editing}
          onClose={() => setEditing(false)}
          location={venue}
          onSaved={onVenueSaved}
        />
      )}
    </>
  );
}
