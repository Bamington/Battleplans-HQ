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
 * BattlePack has no components of its own yet — the three-column editor chrome
 * it is built on (BuilderShell / ListPanel / EditorPanel) is shared, so its
 * demos are in the shared sections above. LOCAL_NAV is empty until the first
 * local component lands.
 *
 * Navigate to this page at: http://localhost:5177/gallery
 */

import {
  GalleryShell,
  GallerySection,
  GalleryNote,
  SharedGallerySections,
  SHARED_GALLERY_NAV,
  Widget2,
  type GalleryNavItem,
} from '@battleplans/ui';

import AppNavbar from '../components/AppNavbar';

// ── Local nav ────────────────────────────────────────────────────────────────

/** Sidebar entries for this app's own sections, appended after the shared ones. */
const LOCAL_NAV: GalleryNavItem[] = [
  { href: '#nav-navbar', label: 'Navbar', icon: <Widget2 className="w-5 h-5" /> },
];

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

    </GalleryShell>
  );
};

export default ComponentGallery;
