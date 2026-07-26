/**
 * GalleryShell.tsx — Shared chrome for every app's component gallery
 *
 * Each app mounts its own /gallery route, but they all share this shell so the
 * three galleries look and navigate the same. An app supplies its nav items and
 * its sections; the shell supplies the sidebar, the header and the layout.
 *
 * Typical use:
 *
 *   <GalleryShell appName="BattlePlan" nav={[...SHARED_GALLERY_NAV, ...LOCAL_NAV]}>
 *     <SharedGallerySections />
 *     <GallerySection id="nav-my-thing" title="My Thing">…</GallerySection>
 *   </GalleryShell>
 *
 * These pages are a development tool only — not a screen users will see.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Sidebar, { SidebarItem } from '../components/Sidebar';
import HR from '../components/HR';
import ListCheck from '../icons/ListCheck';

// ── GallerySection ────────────────────────────────────────────────────────────

/**
 * GallerySection — Wrapper for each component group
 *
 * Renders a labelled section with a divider, keeping the gallery
 * organised as the number of components grows.
 *
 * Props:
 * - title:    Section heading (e.g. "Buttons", "Unit Cards")
 * - id:       Anchor target, so a sidebar item can link to it
 * - children: Component previews to display inside the section
 */
export const GallerySection = ({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) => {
  return (
    <section id={id} className="mb-14">

      {/* Section title + divider */}
      <div className="flex items-center gap-4 mb-6">
        <h2 className="font-body text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {title}
        </h2>
        <div className="h-px bg-gray-200 dark:bg-gray-800 flex-1" />
      </div>

      {/* Component previews */}
      <div className="flex flex-wrap gap-4">
        {children}
      </div>

    </section>
  );
};

// ── GalleryNote ───────────────────────────────────────────────────────────────

/**
 * A caption inside a section — used for the "this demo is stubbed because…"
 * asides that most of the data-driven components need. Full width so it always
 * sits on its own line inside the section's flex-wrap row.
 */
export const GalleryNote = ({ children }: { children: React.ReactNode }) => (
  <p className="font-body text-xs text-gray-400 dark:text-gray-500 w-full">
    {children}
  </p>
);

// ── GalleryShell ──────────────────────────────────────────────────────────────

export interface GalleryNavItem {
  /** Anchor href, e.g. '#nav-buttons' — matches a GallerySection id */
  href: string;
  label: string;
  icon?: React.ReactNode;
}

export interface GalleryShellProps {
  /** Shown in the subtitle, e.g. "BattleCards" */
  appName: string;
  /** Sidebar anchor links, in render order */
  nav: GalleryNavItem[];
  /** Where "← Back to app" points. Defaults to '/'. */
  backTo?: string;
  children: React.ReactNode;
}

const GalleryShell = ({ appName, nav, backTo = '/', children }: GalleryShellProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    // The gallery uses Tailwind's light/dark bg so components are previewed
    // against the correct background colour in both modes.
    <div className="min-h-screen bg-white dark:bg-gray-950">

      {/* ── Gallery navigation sidebar ──────────────────────────────────
          Provides anchor-link navigation to every component section.
          On desktop it is always visible; on mobile it slides in when
          sidebarOpen=true (toggled by the hamburger button below).
      ────────────────────────────────────────────────────────────────── */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        {nav.map(item => (
          <SidebarItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </Sidebar>

      {/* ── Main content — offset on desktop to clear the sidebar ──────── */}
      <div className="sm:ml-64 px-10 py-12">

        {/* ── Page header ────────────────────────────────────────────── */}
        <div className="mb-2 flex items-center gap-3">

          {/* Hamburger — mobile only */}
          <button
            className="sm:hidden shrink-0 p-1.5 rounded-lg
                       text-gray-500 dark:text-gray-400
                       hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <ListCheck className="w-5 h-5" />
          </button>

          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900 dark:text-white">
              Component Gallery
            </h1>
            <p className="font-body text-sm text-gray-500 dark:text-gray-400 mt-1">
              A reference for every UI component used in {appName}.
            </p>
          </div>

        </div>
        <Link to={backTo} className="font-body text-xs text-blue-500 hover:underline">
          ← Back to app
        </Link>

        <HR variant="default" />

        {children}

      </div>
    </div>
  );
};

export default GalleryShell;
