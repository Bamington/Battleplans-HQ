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
import { supabase } from '../lib/supabase';
import logotype from '../assets/battlecards-logotype-svg.svg';
import Button from './Button';
import Dropdown, { DropdownItem, DropdownDivider, DropdownHeader } from './Dropdown';
import Settings from '../icons/Settings';

export interface AppEntry {
  /** Display name shown in the switcher */
  name: string;
  /** URL to navigate to. Use '#' for apps not yet launched. */
  href: string;
  /** Short tagline shown below the name */
  description?: string;
  /** Marks this as the currently active app */
  active?: boolean;
}

interface NavbarProps {
  /** Pin navbar to top of viewport. Set false for in-flow layouts. */
  fixed?: boolean;
  /** Extra Tailwind classes on the outer <nav> element */
  className?: string;
  /** Right-side content — buttons, links, etc. Rendered before the user area. */
  children?: React.ReactNode;
  /**
   * When provided, the logo becomes a platform switcher dropdown.
   * List all Battleplans apps; mark the current one with active: true.
   * Apps with href '#' are shown as coming soon (disabled).
   */
  apps?: AppEntry[];
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

const Navbar = ({ fixed = true, className = '', children, apps }: NavbarProps) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Get the current session on mount, then fetch role
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const { data } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', u.id)
          .single();
        setIsAdmin(data?.role === 'admin');
      }
      setLoading(false);
    });

    // Listen for auth changes (login / logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const displayName =
    user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null;
  const email = user?.email ?? null;
  const initials = getInitials(displayName, email);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <nav
      className={[
        'w-full z-30 bg-gray-900 border-b border-gray-700 shrink-0',
        fixed ? 'fixed top-0 left-0' : 'relative',
        className,
      ].join(' ')}
    >
      <div className="px-3 pt-3 pb-[13px] flex items-center">

        {/* ── Logo / platform switcher ─────────────────────────────── */}
        {apps && apps.length > 0 ? (
          <Dropdown
            align="left"
            menuClassName="w-56"
            trigger={
              <button
                type="button"
                className="shrink-0 flex items-center gap-1.5 cursor-pointer group"
                aria-label="Switch platform"
              >
                <img src={logotype} alt="BattleCards" className="h-4 w-auto" />
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
                key={app.name}
                disabled={app.href === '#'}
                onClick={app.href !== '#' && !app.active ? () => { window.location.href = app.href; } : undefined}
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
            <img src={logotype} alt="BattleCards" className="h-4 w-auto" />
          </Link>
        )}

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
                               hover:bg-blue-950 hover:border-blue-900
                               transition-colors cursor-pointer"
                  >
                    {/* Avatar circle */}
                    <div className="shrink-0 w-[22px] h-[22px] rounded-full bg-blue-900 flex items-center justify-center">
                      <span className="font-body font-bold text-xs text-gray-300 uppercase tracking-[1.2px] leading-4">
                        {initials}
                      </span>
                    </div>
                  </button>
                }
              >
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
  );
};

export default Navbar;
