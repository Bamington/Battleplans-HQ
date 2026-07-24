/**
 * Navbar.tsx — Top navigation bar
 *
 * Matches the Figma "Navbar" component (node 289:2276):
 * dark gray background, BattleCards logo on the left, and an optional
 * right-side slot for nav items / action buttons. Automatically shows
 * the logged-in user's avatar + name/email (with a dropdown to log out),
 * or a "Log In" button when no session exists.
 *
 * USAGE:
 *   // Logo + auth status only
 *   <Navbar />
 *
 *   // With extra nav actions on the right (rendered before user info)
 *   <Navbar>
 *     <Button variant="ghost" color="secondary" size="xs">Library</Button>
 *   </Navbar>
 *
 * PROPS:
 *   fixed     — Pins the bar to the top of the viewport (default: true).
 *   className — Extra Tailwind classes on the outer <nav> element.
 *   children  — Rendered in the right-side flex container before the user area.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { supabase, appendSessionToUrl } from '../lib/supabase';
import { setCurrentApp, type AppSlug } from '../lib/currentApp';
import { avatarUrl } from '../lib/avatars';
import { useProfileDisplay, publishProfileDisplay, clearProfileDisplay } from '../lib/profileDisplay';
import logotype from '../assets/battlecards-logotype-svg.svg';
import Button from './Button';
import Dropdown, { DropdownItem, DropdownDivider, DropdownHeader } from './Dropdown';
import Settings from '../icons/Settings';
import UserCircle from '../icons/UserCircle';
import ProfileModal from './ProfileModal';
import ImpersonationBanner from './ImpersonationBanner';
import { usePlatformApps } from '../hooks/usePlatformApps';
import { useEffectiveRole } from '../hooks/useEffectiveRole';
import { setImpersonatedRole } from '../lib/impersonation';
import Eye from '../icons/Eye';

export interface AppEntry {
  /** Stable id, matching public.platform_apps.slug */
  slug?: string;
  /** Display name shown in the switcher */
  name: string;
  /** URL to navigate to. Use '#' for apps not yet launched. */
  href: string;
  /** Short tagline shown below the name */
  description?: string;
  /** Marks this as the currently active app */
  active?: boolean;
}

export interface Breadcrumb {
  /** Text shown for this crumb */
  label: string;
  /** If set, the crumb links here. Omit for the current-page (last) crumb. */
  href?: string;
}

interface NavbarProps {
  /** Pin navbar to top of viewport. Set false for in-flow layouts. */
  fixed?: boolean;
  /** Extra Tailwind classes on the outer <nav> element */
  className?: string;
  /** Right-side content — buttons, links, etc. Rendered before the user area. */
  children?: React.ReactNode;
  /**
   * Breadcrumb trail shown after the logo. The last crumb is the current page.
   * On narrow screens only the current page and its parent are shown.
   */
  breadcrumbs?: Breadcrumb[];
  /**
   * Overrides the switcher's app list. Normally omitted — the Navbar loads the
   * apps the signed-in user may access itself. Pass this only to render a fixed
   * list (e.g. the component gallery).
   */
  apps?: AppEntry[];
  /**
   * Custom logo element. Defaults to the BattleCards SVG logotype.
   * Pass a <img> or text node to use a different brand mark.
   */
  logo?: React.ReactNode;
}

/** Extract up to two uppercase initials from a name or email. */
function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

/** Solar "Logout 2" icon — door with exit arrow */
const LogoutIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15 16.5V19C15 20.1046 14.1046 21 13 21H6C4.89543 21 4 20.1046 4 19V5C4 3.89543 4.89543 3 6 3H13C14.1046 3 15 3.89543 15 5V7.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18.5 9.5L20.9999 12.0001L18.5 14.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 12H21"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Chevron separator between breadcrumb crumbs. */
const CrumbChevron = ({ className = '' }: { className?: string }) => (
  <svg className={`w-3.5 h-3.5 text-gray-600 shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Breadcrumbs — trail rendered after the logo. Intermediate crumbs link;
 * the last crumb is the current page. On screens below `md` only the current
 * page and its immediate parent are shown.
 */
function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  if (items.length === 0) return null;
  const last = items.length - 1;

  return (
    <nav aria-label="Breadcrumb" className="ml-3 min-w-0 flex items-center">
      <ol className="flex items-center gap-1.5 min-w-0">
        {items.map((c, i) => {
          const isLast = i === last;
          // Keep only the current page + its parent on mobile.
          const hiddenOnMobile = i < last - 1;
          // The parent is the first mobile crumb, so hide its leading chevron there.
          const chevronMobileHidden = i === last - 1;
          return (
            <li key={i} className={`min-w-0 items-center gap-1.5 ${hiddenOnMobile ? 'hidden md:flex' : 'flex'}`}>
              {i > 0 && <CrumbChevron className={chevronMobileHidden ? 'hidden md:block' : ''} />}
              {c.href && !isLast ? (
                <Link
                  to={c.href}
                  className="font-body text-sm text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  className={`font-body text-sm whitespace-nowrap ${isLast ? 'text-gray-200 font-medium truncate' : 'text-gray-400'}`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const Navbar = ({ fixed = true, className = '', children, apps: appsOverride, logo, breadcrumbs = [] }: NavbarProps) => {
  const navigate = useNavigate();
  const { apps: accessibleApps } = usePlatformApps();
  const apps = appsOverride ?? accessibleApps;

  /**
   * Move the user to another Battleplans app.
   *
   * On the web the apps are separate origins, so this is a real navigation and
   * the session has to travel with it. Natively they're all the same binary
   * inside BattlePlan HQ — switching origin there would walk the user out of
   * the app and into a browser, which is exactly what HQ exists to stop. So
   * native swaps the mounted app instead and the session simply stays put.
   */
  async function switchToApp(app: AppEntry): Promise<void> {
    if (Capacitor.isNativePlatform() && app.slug) {
      setCurrentApp(app.slug as AppSlug);
      navigate('/app');
      return;
    }
    window.location.href = await appendSessionToUrl(app.href);
  }
  // realRole gates the "view as" controls; isAdmin follows the previewed role,
  // so Admin Tools correctly disappears while impersonating.
  const { realRole, effectiveRole, isImpersonating } = useEffectiveRole();
  const isAdmin = effectiveRole === 'admin';
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Shared so the onboarding modal — a sibling in the tree, not a child — can
  // update the name and picture the moment it saves.
  const { username, avatarUrl: avatarSrc } = useProfileDisplay();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    // Get the current session on mount, then fetch the display name. The role
    // is handled separately by useEffectiveRole, which also applies the
    // "view as" lens.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const { data } = await supabase
          .from('user_profiles')
          .select('username, avatar_path')
          .eq('id', u.id)
          .single();
        publishProfileDisplay({
          username: data?.username ?? null,
          avatarUrl: avatarUrl(data?.avatar_path),
        });
      }
      setLoading(false);
    });

    // Listen for auth changes (login / logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (!u) clearProfileDisplay();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Prefer the user's chosen username; fall back to the Google name, then email.
  const displayName =
    username ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null;
  const email = user?.email ?? null;
  const initials = getInitials(displayName, email);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <>
    <nav
      className={[
        'w-full z-30 bg-gray-900 border-b border-gray-700 shrink-0',
        // Clears the status bar / notch in a native shell; 0px everywhere else.
        'pt-safe pl-safe pr-safe',
        fixed ? 'fixed top-0 left-0' : 'relative',
        className,
      ].join(' ')}
    >
      <div className="px-3 pt-3 pb-[13px] flex items-center">

        {/* ── Logo / platform switcher ─────────────────────────────── */}
        {/* With only one accessible app there's nothing to switch to, so the
            logo stays a plain link rather than a dropdown of one. */}
        {apps && apps.length > 1 ? (
          <Dropdown
            align="left"
            menuClassName="w-56"
            trigger={
              <button
                type="button"
                className="shrink-0 flex items-center gap-1.5 cursor-pointer group"
                aria-label="Switch platform"
              >
                {logo ?? <img src={logotype} alt="BattleCards" className="h-4 w-auto" />}
                {/* chevron */}
                <svg className="w-3 h-3 text-gray-500 group-hover:text-gray-300 transition-colors" viewBox="0 0 24 24" fill="none">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            }
          >
            <DropdownHeader>
              <p className="font-body text-xs font-semibold text-gray-400 uppercase tracking-wider">Switch platform</p>
            </DropdownHeader>
            {apps.map((app) => (
              <DropdownItem
                key={app.slug ?? app.name}
                disabled={app.href === '#'}
                onClick={
                  app.href === '#'
                    ? undefined
                    : app.active
                      ? () => navigate('/app')
                      : () => switchToApp(app)
                }
                className={app.active ? 'opacity-100' : ''}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className={`font-body font-semibold text-sm leading-none ${app.active ? 'text-blue-400' : ''}`}>
                    {app.name}
                    {app.active && <span className="ml-1.5 text-[10px] font-normal text-blue-500">Current</span>}
                    {app.href === '#' && <span className="ml-1.5 text-[10px] font-normal text-gray-500">Coming soon</span>}
                  </span>
                  {app.description && (
                    <span className="font-body text-xs text-gray-500 leading-none">{app.description}</span>
                  )}
                </div>
              </DropdownItem>
            ))}
          </Dropdown>
        ) : (
          <Link to="/app" className="shrink-0 flex items-center">
            {logo ?? <img src={logotype} alt="BattleCards" className="h-4 w-auto" />}
          </Link>
        )}

        {/* ── Breadcrumbs ──────────────────────────────────────────────── */}
        <Breadcrumbs items={breadcrumbs} />

        {/* ── Right-side slot ──────────────────────────────────────────── */}
        <div className="flex flex-1 items-center justify-end gap-3 min-w-0">
          {children}

          {/* ── Auth area ──────────────────────────────────────────────── */}
          {!loading && (
            user ? (
              /* Logged-in: avatar + name/email with logout dropdown */
              <Dropdown
                align="right"
                menuClassName="w-auto min-w-[160px]"
                trigger={
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-xl
                               border border-transparent
                               hover:bg-primary-950 hover:border-primary-900
                               transition-colors cursor-pointer"
                  >
                    {/* Avatar circle — profile picture, else initials */}
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt={displayName ?? 'Your profile picture'}
                        className="shrink-0 w-[22px] h-[22px] rounded-sm object-cover"
                      />
                    ) : (
                      <div className="shrink-0 w-[22px] h-[22px] rounded-sm bg-primary-900 flex items-center justify-center">
                        <span className="font-body font-bold text-xs text-gray-300 uppercase tracking-[1.2px] leading-4">
                          {initials}
                        </span>
                      </div>
                    )}
                  </button>
                }
              >
                <DropdownItem
                  icon={<UserCircle className="w-4 h-4 text-gray-400" />}
                  onClick={() => setProfileOpen(true)}
                >
                  <span className="text-gray-200">Your Profile</span>
                </DropdownItem>
                <DropdownDivider />
                {isAdmin && (
                  <>
                    <DropdownItem
                      icon={<Settings className="w-4 h-4 text-gray-400" />}
                      onClick={() => navigate('/app/admin')}
                    >
                      <span className="text-gray-200">Admin Tools</span>
                    </DropdownItem>
                    <DropdownDivider />
                  </>
                )}

                {/* ── View as ────────────────────────────────────────────────
                    Offered on realRole, not isAdmin, so "Stop impersonating"
                    stays reachable once the lens has hidden admin status. ── */}
                {realRole === 'admin' && (
                  <>
                    {isImpersonating ? (
                      <DropdownItem
                        icon={<Eye className="w-4 h-4 text-warning-500" />}
                        onClick={() => setImpersonatedRole(null)}
                      >
                        <span className="text-gray-200">Stop impersonating</span>
                      </DropdownItem>
                    ) : (
                      <>
                        <DropdownItem
                          icon={<Eye className="w-4 h-4 text-gray-400" />}
                          onClick={() => setImpersonatedRole('beta_tester')}
                        >
                          <span className="text-gray-200">Impersonate Beta User</span>
                        </DropdownItem>
                        <DropdownItem
                          icon={<Eye className="w-4 h-4 text-gray-400" />}
                          onClick={() => setImpersonatedRole('user')}
                        >
                          <span className="text-gray-200">Impersonate User</span>
                        </DropdownItem>
                      </>
                    )}
                    <DropdownDivider />
                  </>
                )}
                <DropdownItem
                  icon={<LogoutIcon className="w-4 h-4 text-red-500" />}
                  onClick={handleLogout}
                >
                  <span className="text-gray-200">Logout</span>
                </DropdownItem>
              </Dropdown>
            ) : (
              /* Logged-out: "Log In" button */
              <Button
                size="xs"
                color="primary"
                onClick={() => navigate('/login')}
              >
                Log In
              </Button>
            )
          )}
        </div>

      </div>
    </nav>
    {/* No callbacks needed — ProfileModal publishes to the shared store. */}
    <ProfileModal
      open={profileOpen}
      onClose={() => setProfileOpen(false)}
    />
    <ImpersonationBanner />
    </>
  );
};

export default Navbar;
