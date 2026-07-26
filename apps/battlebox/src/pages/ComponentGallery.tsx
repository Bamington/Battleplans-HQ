/**
 * ComponentGallery.tsx — BattleBox Component Gallery
 *
 * A living reference for every UI component in the app.
 * This page is a development tool only — not a screen users will see.
 *
 * HOW IT IS PUT TOGETHER:
 * The chrome (<GalleryShell>) and every demo for a shared @battleplans/ui
 * component (<SharedGallerySections>) live in packages/ui, so all three apps
 * show the same thing. This file only holds the sections for components that
 * live in apps/battlebox/src/components.
 *
 * ADDING A COMPONENT: when you create a component in this app, add a
 * <GallerySection> for it below showing every meaningful variant and state, and
 * add a matching entry to LOCAL_NAV. If the component belongs in packages/ui
 * instead, add its demo to packages/ui/src/gallery/SharedSections.tsx.
 *
 * A NOTE ON STUBBED DATA: BattleBox splits cleanly in two. The list rows and
 * filter controls are presentational — they take a row and render it, so the
 * demos below drive them with literal data and are fully truthful. The modals
 * that take an id (CollectionDetailModal, EditModelModal, ImageEditor, …) fetch
 * that record themselves, so without a session they show their loading and
 * error states. Each section says which it is.
 *
 * Navigate to this page at: http://localhost:5173/gallery
 */

import { useState } from 'react';
import {
  GalleryShell,
  GallerySection,
  GalleryNote,
  SharedGallerySections,
  SHARED_GALLERY_NAV,
  Button,
  type GalleryNavItem,
} from '@battleplans/ui';
import { Widget2, Gallery, ListCheck, Shield, Bookmark, Filter, Pen2, AddCircle, MenuDots, Clipboard } from '@battleplans/ui';

import AppNavbar from '../components/AppNavbar';
import { BoxItem, BoxGridItem, BoxCardBody } from '../components/BoxItem';
import { ModelItem, ModelGridItem, ModelCardBody, CollectionThumb } from '../components/ModelItem';
import { PaintItem } from '../components/PaintItem';
import { PaintPackItem } from '../components/PaintPackItem';
import { PaintPackDetailModal } from '../components/PaintPackDetailModal';
import { PaintPackFilterSheet } from '../components/PaintPackFilterSheet';
import { ModelFilterSheet } from '../components/ModelFilterSheet';
import { CollectionFilterSheet } from '../components/CollectionFilterSheet';
import { KebabMenu } from '../components/KebabMenu';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ImageCarousel } from '../components/ImageCarousel';
import { ImageEditor } from '../components/ImageEditor';
import { GamePicker } from '../components/GamePicker';
import { CollectionPicker } from '../components/CollectionPicker';
import { AddCollectionModal } from '../components/AddCollectionModal';
import { AddModelModal } from '../components/AddModelModal';
import { AddModelsToCollectionModal } from '../components/AddModelsToCollectionModal';
import { AddPaintRecipeModal } from '../components/AddPaintRecipeModal';
import { AddPaintsToRecipeModal } from '../components/AddPaintsToRecipeModal';
import { CollectionDetailModal } from '../components/CollectionDetailModal';
import { ModelDetailModal } from '../components/ModelDetailModal';
import { EditCollectionModal } from '../components/EditCollectionModal';
import { EditModelModal } from '../components/EditModelModal';
import { EditPaintModal } from '../components/EditPaintModal';
import { EditRecipeModal } from '../components/EditRecipeModal';
import { Section, Accordion, Chip, DateRange, GameMultiSelect } from '../components/filterControls';
import { PickRow, ExistingPaintPicker, CloseIcon, CheckIcon, ChevronIcon } from '../components/paintPickerBits';
import { EMPTY_MODEL_FILTERS, EMPTY_COLLECTION_FILTERS } from '../hooks/useCollection';
import type {
  CollectionBox, CollectionModel, ModelFilters, CollectionFilters, PaintRef, ModelRecipeGroup,
} from '../hooks/useCollection';
import type { PaintPack, LibraryPaint } from '../hooks/usePaintPacks';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path contains spaces, TS path resolver struggles but Vite handles fine
import GAME_ICON from '../../../../packages/ui/src/assets/games/icons/blood-bowl.png';

// ── Demo data ────────────────────────────────────────────────────────────────

const PHOTO_A ='https://images.unsplash.com/photo-1608889175123-8ee362201f81?w=600';
const PHOTO_B = 'https://images.unsplash.com/photo-1611996575749-79a3a250f79e?w=600';

const DEMO_BOX: CollectionBox = {
  id: 'box-1',
  name: 'Leviathan Box Set',
  type: 'Box',
  includesString: 'Termagants ×20, Space Marine Captain ×1',
  game: { name: 'Warhammer 40,000', slug: 'warhammer-40k' },
  modelCount: 12,
  allPainted: false,
  allUnpainted: false,
  anyProgress: true,
  images: [PHOTO_A, PHOTO_B],
};

const DEMO_BOX_DONE: CollectionBox = {
  ...DEMO_BOX,
  id: 'box-2',
  name: 'Kill Team: Octarius',
  type: 'Collection',
  includesString: null,
  modelCount: 8,
  allPainted: true,
  allUnpainted: false,
  anyProgress: true,
  images: [PHOTO_B],
};

const DEMO_BOX_EMPTY: CollectionBox = {
  ...DEMO_BOX,
  id: 'box-3',
  name: 'Untouched Sprues',
  includesString: null,
  game: null,
  modelCount: 0,
  allPainted: false,
  allUnpainted: true,
  anyProgress: false,
  images: [],
};

const DEMO_MODEL: CollectionModel = {
  id: 'm-1',
  name: 'Space Marine Captain',
  status: 'Painted',
  count: 1,
  images: [PHOTO_A, PHOTO_B],
  game: { name: 'Warhammer 40,000', slug: 'warhammer-40k' },
  boxName: 'Leviathan Box Set',
};

const DEMO_MODEL_WIP: CollectionModel = {
  id: 'm-2',
  name: 'Termagants',
  status: 'Partially Painted',
  count: 20,
  images: [PHOTO_B],
  game: { name: 'Warhammer 40,000', slug: 'warhammer-40k' },
  boxName: 'Leviathan Box Set',
};

const DEMO_MODEL_BARE: CollectionModel = {
  id: 'm-3',
  name: 'Ork Boyz',
  status: 'None',
  count: 10,
  images: [],
  game: null,
  boxName: null,
};

const DEMO_PAINTS: LibraryPaint[] = [
  { id: 1, name: 'Macragge Blue',    brand: 'Citadel', sub_brand: 'Base',  type: 'Base',   swatch: '#0d407f' },
  { id: 2, name: 'Mephiston Red',    brand: 'Citadel', sub_brand: 'Base',  type: 'Base',   swatch: '#960c0c' },
  { id: 3, name: 'Nuln Oil',         brand: 'Citadel', sub_brand: 'Shade', type: 'Shade',  swatch: '#14100e' },
  { id: 4, name: 'Speedpaint Grim Black', brand: 'Army Painter', sub_brand: null, type: 'Speedpaint', swatch: '#1c1c1c' },
];

/** A paint as it hangs off a model — note it carries the usage note and the
 *  owner id, which is what decides whether you may edit it. */
const DEMO_PAINT_REF: PaintRef = {
  hobbyItemId: 1,
  name: 'Macragge Blue',
  brand: 'Citadel',
  type: 'Paint',
  swatch: '#0d407f',
  note: 'Basecoat, two thin coats',
  ownerId: null,
};

const DEMO_RECIPE: ModelRecipeGroup = {
  id: 'stub-recipe-id',
  name: 'Ultramarines Blue',
  description: 'Base, wash, edge highlight.',
  paints: [
    DEMO_PAINT_REF,
    { hobbyItemId: 3, name: 'Nuln Oil', brand: 'Citadel', type: 'Paint', swatch: '#14100e', note: 'Recess shade', ownerId: null },
  ],
};

const DEMO_PACK: PaintPack = {
  id: 'pk-1',
  owner: null,
  name: 'Citadel Base Paints',
  description: 'The full Citadel Base range — the starting point for most schemes.',
  brand: 'Citadel',
  is_public: true,
  is_official: true,
  image_path: null,
  item_count: 34,
  added: false,
};

const DEMO_PACK_ADDED: PaintPack = {
  ...DEMO_PACK,
  id: 'pk-2',
  name: 'Speedpaint 2.0 Starter',
  description: 'Army Painter\'s contrast-style range.',
  brand: 'Army Painter',
  is_official: false,
  item_count: 12,
  added: true,
};

// ── Local nav ────────────────────────────────────────────────────────────────

/** Sidebar entries for this app's own sections, appended after the shared ones. */
const LOCAL_NAV: GalleryNavItem[] = [
  { href: '#nav-navbar',              label: 'Navbar',                icon: <Widget2 className="w-5 h-5" /> },
  { href: '#nav-box-item',            label: 'Box Item',              icon: <Bookmark className="w-5 h-5" /> },
  { href: '#nav-model-item',          label: 'Model Item',            icon: <Shield className="w-5 h-5" /> },
  { href: '#nav-collection-thumb',    label: 'Collection Thumb',      icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-paint-item',          label: 'Paint Item',            icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-paint-pack-item',     label: 'Paint Pack Item',       icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-paint-pack-detail',   label: 'Paint Pack Detail',     icon: <Bookmark className="w-5 h-5" /> },
  { href: '#nav-image-carousel',      label: 'Image Carousel',        icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-kebab-menu',          label: 'Kebab Menu',            icon: <MenuDots className="w-5 h-5" /> },
  { href: '#nav-confirm-dialog',      label: 'Confirm Dialog',        icon: <AddCircle className="w-5 h-5" /> },
  { href: '#nav-filter-controls',     label: 'Filter Controls',       icon: <Filter className="w-5 h-5" /> },
  { href: '#nav-filter-sheets',       label: 'Filter Sheets',         icon: <Filter className="w-5 h-5" /> },
  { href: '#nav-paint-picker-bits',   label: 'Paint Picker Bits',     icon: <Clipboard className="w-5 h-5" /> },
  { href: '#nav-pickers',             label: 'Game & Collection Pickers', icon: <Clipboard className="w-5 h-5" /> },
  { href: '#nav-image-editor',        label: 'Image Editor',          icon: <Pen2 className="w-5 h-5" /> },
  { href: '#nav-add-modals',          label: 'Add Modals',            icon: <AddCircle className="w-5 h-5" /> },
  { href: '#nav-detail-modals',       label: 'Detail Modals',         icon: <Bookmark className="w-5 h-5" /> },
  { href: '#nav-edit-modals',         label: 'Edit Modals',           icon: <Pen2 className="w-5 h-5" /> },
];

// ── Gallery page ─────────────────────────────────────────────────────────────

const ComponentGallery = () => {
  const [packDetail,     setPackDetail]     = useState<PaintPack | null>(null);
  const [packFilterOpen, setPackFilterOpen] = useState(false);
  const [packBrands,     setPackBrands]     = useState<string[]>([]);
  const [modelFilters,   setModelFilters]   = useState<ModelFilters>(EMPTY_MODEL_FILTERS);
  const [modelFilterOpen,setModelFilterOpen]= useState(false);
  const [collFilters,    setCollFilters]    = useState<CollectionFilters>(EMPTY_COLLECTION_FILTERS);
  const [collFilterOpen, setCollFilterOpen] = useState(false);
  const [confirmOpen,    setConfirmOpen]    = useState(false);
  const [game,           setGame]           = useState<string | null>(null);
  const [collection,     setCollection]     = useState<string | null>(null);

  // filterControls demo state
  const [chipOn,         setChipOn]         = useState(true);
  const [accordionOpen,  setAccordionOpen]  = useState(true);
  const [dateFrom,       setDateFrom]       = useState<string | null>('2026-01-01');
  const [dateTo,         setDateTo]         = useState<string | null>(null);
  const [pickedGames,    setPickedGames]    = useState<string[]>(['g-1']);
  const [pickRowOn,      setPickRowOn]      = useState(false);
  const [pickedPaints,   setPickedPaints]   = useState<number[]>([]);

  // Modals that self-fetch
  const [addCollectionOpen, setAddCollectionOpen] = useState(false);
  const [addModelOpen,      setAddModelOpen]      = useState(false);
  const [addToCollOpen,     setAddToCollOpen]     = useState(false);
  const [addRecipeOpen,     setAddRecipeOpen]     = useState(false);
  const [addPaintsOpen,     setAddPaintsOpen]     = useState(false);
  const [collDetailOpen,    setCollDetailOpen]    = useState(false);
  const [modelDetailOpen,   setModelDetailOpen]   = useState(false);
  const [editCollOpen,      setEditCollOpen]      = useState(false);
  const [editModelOpen,     setEditModelOpen]     = useState(false);
  const [editPaintOpen,     setEditPaintOpen]     = useState(false);
  const [editRecipeOpen,    setEditRecipeOpen]    = useState(false);

  return (
    <GalleryShell appName="BattleBox" nav={[...SHARED_GALLERY_NAV, ...LOCAL_NAV]} backTo="/app">

      {/* Every @battleplans/ui component — see packages/ui/src/gallery/SharedSections.tsx */}
      <SharedGallerySections />

      {/* ════════════════════════════════════════════════════════════════
          Everything below is a BattleBox-only component.
      ════════════════════════════════════════════════════════════════ */}

      <GallerySection id="nav-navbar" title="Navbar / Default">
        <div className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <AppNavbar fixed={false} />
          <div className="h-24 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
            <p className="font-body text-sm text-gray-400">Page content sits beneath the navbar</p>
          </div>
        </div>
        <GalleryNote>
          Thin wrapper over the shared &lt;Navbar&gt; that supplies BattleBox's
          breadcrumb trail and its amber accent.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BOX ITEM
          A collection or box in the Collections column. BoxCardBody is the
          shared inner layout; the list row and grid tile both wrap it.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-box-item" title="Box Item / List, Grid & Body">
        <div className="w-full flex flex-col gap-6">
          <div className="max-w-xl flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              BoxItem — the list row
            </p>
            <BoxItem box={DEMO_BOX}       onClick={() => alert('Open collection')} />
            <BoxItem box={DEMO_BOX_DONE}  onClick={() => alert('Open collection')} />
            <BoxItem box={DEMO_BOX_EMPTY} />
          </div>

          <div className="max-w-2xl">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              BoxGridItem — the gallery tile
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <BoxGridItem box={DEMO_BOX}       onClick={() => alert('Open')} />
              <BoxGridItem box={DEMO_BOX_DONE}  onClick={() => alert('Open')} />
              <BoxGridItem box={DEMO_BOX_EMPTY} />
            </div>
          </div>

          <div className="max-w-xl rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              BoxCardBody — the shared inner layout
            </p>
            <BoxCardBody box={DEMO_BOX} />
          </div>
        </div>
        <GalleryNote>
          Three states worth seeing: in progress (some models painted), fully
          painted, and an empty box with no game and no photos — which falls back
          to the initials thumbnail. A box's carousel images are its own cover
          photos followed by one photo per member model.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          MODEL ITEM
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-model-item" title="Model Item / List, Grid & Body">
        <div className="w-full flex flex-col gap-6">
          <div className="max-w-xl flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              ModelItem — the list row
            </p>
            <ModelItem model={DEMO_MODEL}      onClick={() => alert('Open model')} />
            <ModelItem model={DEMO_MODEL_WIP}  onClick={() => alert('Open model')} />
            <ModelItem model={DEMO_MODEL_BARE} />
          </div>

          <div className="max-w-2xl">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              ModelGridItem — the gallery tile
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <ModelGridItem model={DEMO_MODEL}      onClick={() => alert('Open')} />
              <ModelGridItem model={DEMO_MODEL_WIP}  onClick={() => alert('Open')} />
              <ModelGridItem model={DEMO_MODEL_BARE} />
            </div>
          </div>

          <div className="max-w-xl rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              ModelCardBody — the shared inner layout
            </p>
            <ModelCardBody model={DEMO_MODEL} />
          </div>
        </div>
        <GalleryNote>
          Status drives the badge: Painted, Partially Painted, and None
          (unpainted) are shown here — Assembled and Primed are the other two. A
          model with several photos auto-rotates them in its thumbnail.
        </GalleryNote>
      </GallerySection>

      <GallerySection id="nav-collection-thumb" title="Collection Thumb">
        <div className="flex flex-wrap items-start gap-4">
          <CollectionThumb images={[PHOTO_A, PHOTO_B]} iconUrl={null} name="Leviathan Box Set" dots />
          <CollectionThumb images={[PHOTO_B]} iconUrl={null} name="Kill Team: Octarius" />
          <CollectionThumb images={[]} iconUrl={GAME_ICON} name="Falls back to the game icon" />
          <CollectionThumb images={[]} iconUrl={null} name="Untouched Sprues" />
          <CollectionThumb images={[]} iconUrl={null} name="Small" className="w-[64px] h-[64px]" />
        </div>
        <GalleryNote>
          The square photo thumbnail used by every list row and tile. With no
          images it falls back to the game icon, then to the name's initials.
          <code>dots</code> adds the carousel indicator; <code>className</code>{' '}
          sets the size.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          PAINTS
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-paint-item" title="Paint Item">
        <div className="w-full max-w-md flex flex-col gap-2">
          {DEMO_PAINTS.map(p => <PaintItem key={p.id} paint={p} />)}
        </div>
        <GalleryNote>
          One paint in the My Paints list: swatch, name, and the brand / sub-brand
          line. The last row has no sub-brand.
        </GalleryNote>
      </GallerySection>

      <GallerySection id="nav-paint-pack-item" title="Paint Pack Item">
        <div className="w-full max-w-md flex flex-col gap-2">
          <PaintPackItem pack={DEMO_PACK}       onClick={() => setPackDetail(DEMO_PACK)} />
          <PaintPackItem pack={DEMO_PACK_ADDED} onClick={() => setPackDetail(DEMO_PACK_ADDED)} />
        </div>
        <GalleryNote>
          The whole card is a button. A pack already in your collection carries the
          extra "In your collection" badge — the second row. With no{' '}
          <code>image_path</code> the thumbnail falls back to the brand's initial.
        </GalleryNote>
      </GallerySection>

      <GallerySection id="nav-paint-pack-detail" title="Paint Pack Detail Modal">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setPackDetail(DEMO_PACK)}>Open (not added)</Button>
          <Button variant="outline" color="secondary" onClick={() => setPackDetail(DEMO_PACK_ADDED)}>
            Open (already added)
          </Button>
          <GalleryNote>
            The pack header is driven by the row you pass, so it is truthful here;
            the paint list underneath is fetched by pack id, so signed out (or with
            this stub id) it shows the loading then empty state. Which action shows
            — Add or Remove — comes from <code>pack.added</code>.
          </GalleryNote>
          <PaintPackDetailModal
            pack={packDetail}
            busy={false}
            onClose={() => setPackDetail(null)}
            onAdd={() => setPackDetail(null)}
            onRemove={() => setPackDetail(null)}
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          IMAGE CAROUSEL
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-image-carousel" title="Image Carousel">
        <div className="w-full flex flex-wrap gap-6 items-start">
          <div className="w-64">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">With dots</p>
            <ImageCarousel images={[PHOTO_A, PHOTO_B]} alt="Model photos" dots />
          </div>
          <div className="w-64">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              Clickable (opens a Lightbox in the app)
            </p>
            <ImageCarousel
              images={[PHOTO_A, PHOTO_B]}
              alt="Model photos"
              dots
              onImageClick={() => alert('Open lightbox')}
            />
          </div>
          <div className="w-64">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Single image, no dots</p>
            <ImageCarousel images={[PHOTO_B]} alt="Model photo" />
          </div>
        </div>
        <GalleryNote>
          Auto-rotates through the images it is given. <code>autoHeight</code> lets
          it size to the image instead of filling its box; in the detail modals it
          is paired with the shared &lt;Lightbox&gt; via{' '}
          <code>onImageClick</code>.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          KEBAB MENU & CONFIRM DIALOG
          Two small primitives used across every list and detail screen.
          Both are good candidates to promote into packages/ui.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-kebab-menu" title="Kebab Menu">
        <div className="flex flex-wrap items-center gap-8">
          <KebabMenu
            items={[
              { label: 'Edit',      onClick: () => alert('Edit') },
              { label: 'Duplicate', onClick: () => alert('Duplicate') },
              { label: 'Delete',    onClick: () => alert('Delete'), danger: true },
            ]}
          />
          <KebabMenu label="Model actions" items={[{ label: 'Only one action', onClick: () => alert('Go') }]} />
        </div>
        <GalleryNote>
          The overflow menu on list rows and modal headers. <code>danger</code>{' '}
          marks a destructive item red; <code>label</code> sets the trigger's
          accessible name.
        </GalleryNote>
      </GallerySection>

      <GallerySection id="nav-confirm-dialog" title="Confirm Dialog">
        <div className="flex flex-wrap items-center gap-3">
          <Button color="danger" onClick={() => setConfirmOpen(true)}>Delete model…</Button>
          <GalleryNote>
            The "are you sure?" step in front of every destructive action.
            Fully presentational — this demo is live.
          </GalleryNote>
          <ConfirmDialog
            open={confirmOpen}
            title="Delete this model?"
            message="Space Marine Captain and its photos will be permanently removed. This can't be undone."
            confirmLabel="Delete"
            onConfirm={() => setConfirmOpen(false)}
            onCancel={() => setConfirmOpen(false)}
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          FILTER CONTROLS
          The building blocks every filter sheet is assembled from.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-filter-controls" title="Filter Controls">
        <div className="w-full max-w-md flex flex-col gap-6">

          <Section title="Status" active={chipOn} onReset={() => setChipOn(false)}>
            <div className="flex flex-wrap gap-2">
              <Chip label="Unpainted"         selected={!chipOn} onClick={() => setChipOn(false)} />
              <Chip label="Painted"           selected={chipOn}  onClick={() => setChipOn(true)} />
              <Chip label="Partially Painted" selected={false}   onClick={() => {}} />
            </div>
          </Section>

          <Accordion
            title="Purchase date"
            active={!!dateFrom || !!dateTo}
            expanded={accordionOpen}
            onToggle={() => setAccordionOpen(o => !o)}
            onReset={() => { setDateFrom(null); setDateTo(null); }}
          >
            <DateRange
              from={dateFrom}
              to={dateTo}
              onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
              years={[2024, 2025, 2026]}
            />
          </Accordion>

          <Section title="Games" active={pickedGames.length > 0} onReset={() => setPickedGames([])}>
            <GameMultiSelect
              games={[
                { id: 'g-1', name: 'Warhammer 40,000', slug: 'warhammer-40k', count: 12 },
                { id: 'g-2', name: 'Age of Sigmar',    slug: 'age-of-sigmar',  count: 5 },
                { id: 'g-3', name: 'Kill Team',        slug: 'kill-team',      count: 8 },
              ]}
              selected={pickedGames}
              onToggle={id => setPickedGames(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id])}
            />
          </Section>

          <GalleryNote>
            A Section is always open; an Accordion collapses. Both show a reset
            control only while <code>active</code>, which is how the sheets show you
            what you have filtered on. Picked games: {pickedGames.join(', ') || '(none)'}.
          </GalleryNote>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          FILTER SHEETS
          Each column's filters, built on the shared <Sheet>.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-filter-sheets" title="Filter Sheets">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setModelFilterOpen(true)}>Model filters</Button>
          <Button variant="outline" color="secondary" onClick={() => setCollFilterOpen(true)}>
            Collection filters
          </Button>
          <Button variant="outline" color="secondary" onClick={() => setPackFilterOpen(true)}>
            Paint pack filters
          </Button>

          <GalleryNote>
            All three are bottom sheets on mobile and centred dialogs at lg+. The
            model and collection sheets load their game list and available years
            from Supabase when opened, so signed out those groups are empty — the
            status and type chips still work. The pack sheet takes its brands as a
            prop, so it is fully live here. Applied model filters:{' '}
            {JSON.stringify(modelFilters)}.
          </GalleryNote>

          <ModelFilterSheet
            open={modelFilterOpen}
            onClose={() => setModelFilterOpen(false)}
            userId={null}
            value={modelFilters}
            onApply={f => { setModelFilters(f); setModelFilterOpen(false); }}
          />
          <CollectionFilterSheet
            open={collFilterOpen}
            onClose={() => setCollFilterOpen(false)}
            userId={null}
            value={collFilters}
            onApply={f => { setCollFilters(f); setCollFilterOpen(false); }}
          />
          <PaintPackFilterSheet
            open={packFilterOpen}
            onClose={() => setPackFilterOpen(false)}
            brands={['Citadel', 'Army Painter', 'Vallejo', 'Scale75']}
            value={packBrands}
            onApply={b => { setPackBrands(b); setPackFilterOpen(false); }}
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          PAINT PICKER BITS
          Shared pieces of the "choose paints" flows.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-paint-picker-bits" title="Paint Picker Bits">
        <div className="w-full max-w-md flex flex-col gap-6">
          <div className="flex items-center gap-4 text-gray-900 dark:text-white">
            <span className="font-body text-xs text-gray-400 dark:text-gray-500">Icons:</span>
            <CloseIcon /><CheckIcon /><ChevronIcon />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              PickRow — one selectable paint
            </p>
            <PickRow
              title="Macragge Blue"
              subtitle="Citadel · Base"
              swatch="#0d407f"
              selected={pickRowOn}
              onSelect={() => setPickRowOn(o => !o)}
            />
            <PickRow
              title="Nuln Oil"
              subtitle="Citadel · Shade"
              swatch="#14100e"
              selected={false}
              onSelect={() => {}}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              ExistingPaintPicker — searches your paint library
            </p>
            <div className="h-64 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <ExistingPaintPicker
                selectedIds={pickedPaints}
                onToggle={id => setPickedPaints(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
              />
            </div>
          </div>

          <GalleryNote>
            PickRow is presentational and live here. ExistingPaintPicker queries
            your own paint library, so signed out it shows its empty state — the
            search box and chrome are still worth reviewing.
          </GalleryNote>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          PICKERS
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-pickers" title="Game & Collection Pickers">
        <div className="w-full flex flex-wrap gap-6 items-start">
          <div className="w-64">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">GamePicker</p>
            <GamePicker value={game} onChange={setGame} />
          </div>
          <div className="w-64">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              CollectionPicker (scoped to the picked game)
            </p>
            <CollectionPicker userId={null} gameId={game} value={collection} onChange={setCollection} />
          </div>
          <div className="w-64">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Disabled</p>
            <CollectionPicker userId={null} gameId={null} value={null} onChange={() => {}} enabled={false} />
          </div>
          <GalleryNote>
            Both load their options from Supabase, so signed out they show their
            empty states. CollectionPicker is scoped by <code>gameId</code> — that
            is why the add-model flow picks a game first — and{' '}
            <code>enabled={'{false}'}</code> is how it stays disabled until one is
            chosen.
          </GalleryNote>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          IMAGE EDITOR
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-image-editor" title="Image Editor">
        <div className="w-full max-w-lg">
          <ImageEditor kind="model" id="stub-model-id" onChanged={() => {}} />
        </div>
        <GalleryNote>
          Manages the photo set for one model or box — upload, reorder, set the
          primary, delete. It loads and writes by id, so with this stub id it shows
          the empty state; uploads will fail without a session. Note deletes are
          surgical: only the exact object key it created is removed.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          ADD MODALS
          The creation flows. Each writes on save, so they need a session;
          their chrome and validation are what the gallery is for.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-add-modals" title="Add Modals">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setAddCollectionOpen(true)}>Add Collection</Button>
          <Button onClick={() => setAddModelOpen(true)}>Add Model</Button>
          <Button variant="outline" color="secondary" onClick={() => setAddToCollOpen(true)}>
            Add Models to Collection
          </Button>
          <Button variant="outline" color="secondary" onClick={() => setAddRecipeOpen(true)}>
            Add Paint Recipe
          </Button>
          <Button variant="outline" color="secondary" onClick={() => setAddPaintsOpen(true)}>
            Add Paints to Recipe
          </Button>

          <GalleryNote>
            All five create records, so saving needs a signed-in session and the
            stub ids below will not resolve. Open them to review the forms,
            validation and empty states.
          </GalleryNote>

          <AddCollectionModal
            open={addCollectionOpen}
            onClose={() => setAddCollectionOpen(false)}
            userId={null}
            onCreated={() => setAddCollectionOpen(false)}
          />
          <AddModelModal
            open={addModelOpen}
            onClose={() => setAddModelOpen(false)}
            userId={null}
            onCreated={() => setAddModelOpen(false)}
          />
          {addToCollOpen && (
            <AddModelsToCollectionModal
              boxId="stub-box-id"
              userId={null}
              onClose={() => setAddToCollOpen(false)}
              onAdded={() => setAddToCollOpen(false)}
            />
          )}
          <AddPaintRecipeModal
            open={addRecipeOpen}
            onClose={() => setAddRecipeOpen(false)}
            kind="recipe"
            modelId="stub-model-id"
            onAdded={() => setAddRecipeOpen(false)}
          />
          <AddPaintsToRecipeModal
            open={addPaintsOpen}
            onClose={() => setAddPaintsOpen(false)}
            recipeId="stub-recipe-id"
            startOrder={0}
            excludeIds={[]}
            onAdded={() => setAddPaintsOpen(false)}
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          DETAIL MODALS
          The two big read screens. Both fetch by id.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-detail-modals" title="Detail Modals">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setCollDetailOpen(true)}>Collection Detail</Button>
          <Button onClick={() => setModelDetailOpen(true)}>Model Detail</Button>

          <GalleryNote>
            ModelDetailModal is the app's largest component — Details, Painting and
            Lore tabs with inline auto-save. Both load their record by id, so with
            these stub ids you see the loading then not-found state rather than a
            populated modal; to review them fully, open the gallery in a signed-in
            session and swap in a real id.
          </GalleryNote>

          {collDetailOpen && (
            <CollectionDetailModal
              boxId="stub-box-id"
              onClose={() => setCollDetailOpen(false)}
              onOpenModel={() => {}}
              onChanged={() => {}}
            />
          )}
          {modelDetailOpen && (
            <ModelDetailModal
              modelId="stub-model-id"
              onClose={() => setModelDetailOpen(false)}
              onChanged={() => {}}
              onOpenBox={() => {}}
            />
          )}
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          EDIT MODALS
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-edit-modals" title="Edit Modals">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setEditCollOpen(true)}>Edit Collection</Button>
          <Button onClick={() => setEditModelOpen(true)}>Edit Model</Button>
          <Button variant="outline" color="secondary" onClick={() => setEditPaintOpen(true)}>Edit Paint</Button>
          <Button variant="outline" color="secondary" onClick={() => setEditRecipeOpen(true)}>Edit Recipe</Button>

          <GalleryNote>
            Edit Paint and Edit Recipe take the row to edit as a prop, so those two
            are populated and truthful here. Edit Collection and Edit Model fetch by
            id and will show their not-found state against these stub ids.
          </GalleryNote>

          <EditCollectionModal
            open={editCollOpen}
            onClose={() => setEditCollOpen(false)}
            boxId="stub-box-id"
            onChanged={() => {}}
          />
          <EditModelModal
            open={editModelOpen}
            onClose={() => setEditModelOpen(false)}
            modelId="stub-model-id"
            onChanged={() => {}}
          />
          <EditPaintModal
            open={editPaintOpen}
            onClose={() => setEditPaintOpen(false)}
            modelId="stub-model-id"
            paint={DEMO_PAINT_REF}
            onChanged={() => {}}
          />
          <EditRecipeModal
            open={editRecipeOpen}
            onClose={() => setEditRecipeOpen(false)}
            recipe={DEMO_RECIPE}
            onChanged={() => {}}
          />
        </div>
      </GallerySection>

    </GalleryShell>
  );
};

export default ComponentGallery;
