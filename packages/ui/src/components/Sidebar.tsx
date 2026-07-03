/**
 * Sidebar.tsx — Side navigation panel
 *
 * A vertical navigation sidebar. On desktop (≥sm) it is always visible
 * on the left. On mobile it slides in as an off-canvas drawer, controlled
 * by `isOpen` / `onClose` from the parent.
 *
 * STRUCTURE:
 * ┌──────────┐
 * │ [Header] │  ← optional logo / app name
 * ├──────────┤
 * │ [Items]  │  ← nav items with icons and labels
 * ├──────────┤
 * │ [Footer] │  ← optional user profile, settings, etc.
 * └──────────┘
 *
 * ADDING CONTENT:
 * - Items:  Add <SidebarItem> elements inside the items slot
 * - Header: Replace the placeholder in the header slot
 * - Footer: Add a user avatar or settings link in the footer slot
 *
 * PROPS:
 * - isOpen:    Controls visibility on mobile (pass state from parent)
 * - onClose:   Called when the mobile overlay is tapped
 * - width:     Sidebar width class (default: 'w-64')
 * - className: Extra Tailwind classes on the <aside> element
 */

import React from 'react';
import CloseCircle from '../icons/CloseCircle';

interface SidebarProps {
  /** Whether the sidebar drawer is open on mobile */
  isOpen?: boolean;
  /** Callback to close the sidebar when the overlay is tapped on mobile */
  onClose?: () => void;
  /** Tailwind width class — defaults to w-64 (256px) */
  width?: string;
  /** Extra Tailwind classes on the <aside> element */
  className?: string;
  /**
   * Nav items to render inside the sidebar.
   * Pass <SidebarItem> elements; when omitted a placeholder is shown.
   */
  children?: React.ReactNode;
}

const Sidebar = ({
  isOpen = false,
  onClose,
  width = 'w-64',
  className = '',
  children,
}: SidebarProps) => {
  return (
    <>
      {/* ── Mobile overlay ────────────────────────────────────────────
          Dark backdrop shown behind the sidebar on mobile.
          Tapping it calls onClose() to dismiss the sidebar.
      ──────────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 sm:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar panel ─────────────────────────────────────────────
          On mobile:  off-screen by default, slides in when isOpen=true
          On desktop: always visible (sm:translate-x-0)
      ──────────────────────────────────────────────────────────────── */}
      <aside
        className={[
          // Base layout
          'fixed top-0 left-0 z-30 h-full flex flex-col',
          'bg-white dark:bg-gray-900',
          'border-r border-gray-200 dark:border-gray-700',
          width,
          // Mobile: slide in/out; desktop: always shown
          'transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0',
          className,
        ].join(' ')}
        aria-label="Sidebar navigation"
      >

        {/* ── Header slot ───────────────────────────────────────────────
            Place your logo, app name, or user greeting here.
            Example:
              <Link to="/" className="flex items-center gap-2">
                <img src="/logo.svg" className="h-7" alt="BattleCards" />
                <span className="font-heading text-white text-lg">BattleCards</span>
              </Link>
        ──────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-4
                        border-b border-gray-200 dark:border-gray-700">

          {/* Header content goes here */}
          <span className="font-heading text-base text-gray-900 dark:text-white">
            BattleCards
          </span>

          {/* Close button — visible on mobile only */}
          <button
            className="sm:hidden p-1.5 rounded-lg text-gray-500 dark:text-gray-400
                       hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <CloseCircle className="w-4 h-4" />
          </button>

        </div>

        {/* ── Nav items slot ────────────────────────────────────────────
            Add <SidebarItem> elements here as screens are built.
            Example:
              <SidebarItem href="/" icon={<Home />} label="Home" active />
              <SidebarItem href="/library" icon={<Grid />} label="Card Library" />
              <SidebarItem href="/editor" icon={<Edit />} label="Card Editor" />
        ──────────────────────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {children ?? (
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 italic px-2">
              No items yet
            </p>
          )}
        </nav>

        {/* ── Footer slot ───────────────────────────────────────────────
            Place user profile info, a settings link, or a logout button.
            Example:
              <SidebarItem href="/settings" icon={<Cog />} label="Settings" />
              <UserAvatar name="Bamington" />
        ──────────────────────────────────────────────────────────────── */}
        <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-700">
          {/* Footer content goes here */}
        </div>

      </aside>
    </>
  );
};

/**
 * SidebarItem — A single navigation item for use inside Sidebar.
 *
 * Renders a link with an icon on the left and a text label.
 * Pass `active` to highlight the currently active route.
 *
 * Props:
 * - href:     The URL to navigate to
 * - icon:     A React node — use any Flowbite icon (outline recommended)
 * - label:    The text label shown next to the icon
 * - active:   Highlights this item as the current page
 * - badge:    Optional count badge shown on the right (e.g. notifications)
 */
interface SidebarItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
}

export const SidebarItem = ({
  href,
  icon,
  label,
  active = false,
  badge,
}: SidebarItemProps) => (
  <a
    href={href}
    className={[
      'flex items-center gap-3 px-3 py-2 rounded-lg',
      'font-body text-sm transition-colors',
      active
        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
    ].join(' ')}
    aria-current={active ? 'page' : undefined}
  >
    {/* Icon */}
    <span className="shrink-0">{icon}</span>

    {/* Label */}
    <span className="flex-1 truncate">{label}</span>

    {/* Optional badge (e.g. unread count) */}
    {badge !== undefined && badge > 0 && (
      <span className="ml-auto inline-flex items-center justify-center
                       w-5 h-5 rounded-full text-xs font-medium
                       bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </a>
);

export default Sidebar;
