/**
 * ComponentGallery.tsx — BattlePack Component Gallery (apps/battlepack)
 *
 * A living reference for every UI component in the app.
 * This page is a development tool only — not a screen users will see.
 *
 * HOW IT IS PUT TOGETHER:
 * The chrome (<GalleryShell>) and every demo for a shared @battleplans/ui
 * component (<SharedGallerySections>) live in packages/ui, so all four apps
 * show the same thing. This file only holds the sections for components that
 * live in apps/battlepack/src/components.
 *
 * ADDING A COMPONENT: when you create a component in this app, add a
 * <GallerySection> for it below showing every meaningful variant and state, and
 * add a matching entry to LOCAL_NAV. If the component belongs in packages/ui
 * instead, add its demo to packages/ui/src/gallery/SharedSections.tsx.
 *
 * The three-column editor chrome BattlePack is built on (BuilderShell /
 * ListPanel / EditorPanel) is shared, so its demos are in the shared sections
 * above rather than here.
 *
 * Navigate to this page at: http://localhost:5177/gallery
 */

import { useState } from 'react';
import {
  GalleryShell,
  GallerySection,
  GalleryNote,
  SharedGallerySections,
  SHARED_GALLERY_NAV,
  Calendar,
  Gallery,
  ListCheck,
  MapPin,
  MenuDots,
  Widget2,
  type GalleryNavItem,
} from '@battleplans/ui';

import AppNavbar from '../components/AppNavbar';
import CategoryListItem from '../components/CategoryListItem';
import BattlepackListItem from '../components/BattlepackListItem';
import {
  PackHero, DocumentSection, EmptySection, KeyInfoCard, ScheduleTable,
} from '../components/PackDocument';
import { CATEGORY_REGISTRY } from '../registry/categories';

// ── Local nav ────────────────────────────────────────────────────────────────

/** Sidebar entries for this app's own sections, appended after the shared ones. */
const LOCAL_NAV: GalleryNavItem[] = [
  { href: '#nav-navbar',              label: 'Navbar',               icon: <Widget2 className="w-5 h-5" /> },
  { href: '#nav-category-list-item',  label: 'Category List Item',   icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-battlepack-list-item', label: 'Battlepack List Item', icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-pack-document',       label: 'Pack Document',        icon: <Gallery className="w-5 h-5" /> },
];

// ── Demos ────────────────────────────────────────────────────────────────────

/** Stateful so selection actually moves between rows. */
const CategoryListDemo = () => {
  const [active, setActive] = useState('event-basics');

  return (
    <div className="w-64 bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-1">
      {CATEGORY_REGISTRY.slice(0, 5).map((c, i) => (
        <CategoryListItem
          key={c.key}
          icon={c.icon}
          label={c.label}
          /* Alternating so both badge states are on screen at once. */
          complete={i % 2 === 0}
          active={c.key === active}
          onSelect={() => setActive(c.key)}
          onRemove={c.requirement === 'mandatory' ? undefined : () => {}}
        />
      ))}
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

const ComponentGallery = () => {
  return (
    <GalleryShell appName="BattlePack" nav={[...SHARED_GALLERY_NAV, ...LOCAL_NAV]} backTo="/app">

      {/* Every @battleplans/ui component — see packages/ui/src/gallery/SharedSections.tsx */}
      <SharedGallerySections appName="BattlePack" />

      {/* ── This app's own components ── */}

      <GallerySection id="nav-navbar" title="Navbar">
        <div className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <AppNavbar fixed={false} />
        </div>
        <GalleryNote>
          BattlePack's wrapper around the shared <code>&lt;Navbar&gt;</code>. It
          supplies the breadcrumb trail for the current route; the app list in
          the platform switcher comes from the database, so it reflects whatever
          the signed-in user may access.
        </GalleryNote>
      </GallerySection>

      <GallerySection id="nav-category-list-item" title="Category List Item">
        <CategoryListDemo />

        <GalleryNote>
          One row of the editor's left-hand category nav, driven by the registry.
          Click a row to move the selection. The status line is the category's
          own <code>isComplete</code> rule — every required field filled — which
          is also what gates publishing. Mandatory categories get no × because
          they cannot be removed from a pack; that is what stops a half-filled
          category being hidden out of the publish check. Hover a removable row
          to reveal its ×.
        </GalleryNote>
      </GallerySection>

      <GallerySection id="nav-battlepack-list-item" title="Battlepack List Item">
        <div className="w-full max-w-sm flex flex-col gap-3">
          <BattlepackListItem
            name="Warhammer 40,000 League at Gaming Arena - Season 6"
            gameName="Warhammer 40,000"
            startsOn="2026-07-14"
            endsOn="2026-09-26"
            status="published"
            menu={<MenuDots className="w-4 h-4" />}
          />

          {/* A pack is created with only a name and a game, so this is what the
              row looks like for most of its early life. */}
          <BattlepackListItem
            name="July RTT"
            gameName="Warhammer 40,000"
            status="draft"
            menu={<MenuDots className="w-4 h-4" />}
          />

          <BattlepackListItem
            name="Winter Narrative Weekend"
            gameName="Kill Team"
            startsOn="2026-02-07"
            status="unpublished"
          />
        </div>

        <GalleryNote>
          The home column's event row. Dates are omitted rather than rendered
          blank, because a brand-new pack genuinely has none yet. The status
          badge distinguishes a draft from a live event and from one that has
          been withdrawn — an unpublished pack keeps its URL, which serves a
          tombstone rather than a 404.
        </GalleryNote>
      </GallerySection>

      <GallerySection id="nav-pack-document" title="Pack Document">
        <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <PackHero name="July RTT" gameName="Warhammer 40,000" subtitle="2000 Points" />

          <div className="px-4 pb-4 flex flex-col gap-2">
            <DocumentSection categoryKey="demo-basics" title="Event Basics" active>
              <p>
                Join us at The Gaming Arena for another community-run tournament.
                This section is the one the left nav currently has selected.
              </p>
            </DocumentSection>

            <DocumentSection categoryKey="demo-key-info" title="Key Info">
              <KeyInfoCard
                rows={[
                  { icon: <MapPin className="w-4 h-4" />,   text: '2/86 Cottrell Street, Werribee, VIC' },
                  { icon: <Calendar className="w-4 h-4" />, text: 'Saturday, 13/06/26' },
                ]}
              />
            </DocumentSection>

            <DocumentSection categoryKey="demo-schedule" title="Rounds & Breaks">
              <ScheduleTable
                rows={[
                  { ordinal: 0, kind: 'break', label: 'Registration', time: '10:00 AM - 12:00 PM' },
                  { ordinal: 1, kind: 'round', label: 'Round 1',      time: '12:00 PM - 2:00 PM' },
                  { ordinal: 2, kind: 'break', label: 'Break',        time: '2:00 PM - 2:30 PM' },
                  { ordinal: 3, kind: 'round', label: 'Round 2',      time: '2:30 PM - 4:30 PM' },
                ]}
              />
            </DocumentSection>

            <DocumentSection categoryKey="demo-empty" title="Prizes">
              <EmptySection hint="Nothing in Prizes yet." />
            </DocumentSection>
          </div>
        </div>

        <GalleryNote>
          The editor's centre column — the pack as a scrolling document. The
          shared <code>&lt;BuilderShell&gt;</code> takes the centre as a plain
          slot precisely so this can differ from BattleCards' card carousel.
          Each section carries a DOM id that the left nav scrolls to; sections
          own no state and register nothing, because the nav is the sole source
          of truth for what is selected.
        </GalleryNote>
      </GallerySection>

    </GalleryShell>
  );
};

export default ComponentGallery;
