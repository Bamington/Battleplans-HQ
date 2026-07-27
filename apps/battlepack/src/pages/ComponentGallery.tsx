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
  Callout,
  Calendar,
  FileText,
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
import EventBasicsForm from '../components/forms/EventBasicsForm';
import RoundsBreaksForm from '../components/forms/RoundsBreaksForm';
import type { ScheduleOps } from '../components/forms/RoundsBreaksForm';
import { CATEGORY_REGISTRY } from '../registry/categories';
import type { GameOption, LocationOption, Pack, ScheduleItem } from '../lib/packs';

// ── Local nav ────────────────────────────────────────────────────────────────

/** Sidebar entries for this app's own sections, appended after the shared ones. */
const LOCAL_NAV: GalleryNavItem[] = [
  { href: '#nav-navbar',              label: 'Navbar',               icon: <Widget2 className="w-5 h-5" /> },
  { href: '#nav-category-list-item',  label: 'Category List Item',   icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-battlepack-list-item', label: 'Battlepack List Item', icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-pack-document',       label: 'Pack Document',        icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-event-basics-form',   label: 'Event Basics Form',    icon: <FileText className="w-5 h-5" /> },
  { href: '#nav-rounds-breaks-form',  label: 'Rounds & Breaks Form', icon: <ListCheck className="w-5 h-5" /> },
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

/**
 * The Event Basics panel, driven by local state instead of Supabase so it is
 * fully truthful without a session — every save-on-blur writes to the stub pack
 * below and the panel re-renders from it, exactly as the real editor does.
 */
const EventBasicsFormDemo = () => {
  const [pack, setPack] = useState<Pack>({
    id: 'demo', name: 'July RTT', game_id: 'g1', location_id: null,
    starts_on: null, ends_on: null, description: null, owner_id: 'u1',
    status: 'draft', slug: null, created_at: '', updated_at: '',
  });
  const [log, setLog] = useState<string[]>([]);

  const games: GameOption[]     = [{ id: 'g1', name: 'Warhammer 40,000', icon: null, image: null }];
  const venues: LocationOption[] = [
    { id: 'v1', name: 'Gaming Arena',      address: '2/86 Cottrell Street, Werribee, VIC' },
    { id: 'v2', name: 'Battleground North', address: '14 High Street, Preston, VIC' },
  ];

  return (
    <div className="w-full flex flex-col gap-3 lg:flex-row">
      <div className="w-full lg:w-64 shrink-0 bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <EventBasicsForm
          pack={pack}
          rows={{}}
          schedule={[]}
          games={games}
          venues={venues}
          categoryKey="event-basics"
          reload={async () => {}}
          onChange={patch => {
            setPack(prev => ({ ...prev, ...patch }) as Pack);
            setLog(prev => [JSON.stringify(patch), ...prev].slice(0, 5));
          }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <GalleryNote>
          Saving is on blur — there is no submit button, because the editor is a
          place you return to rather than a form you complete. Type in a field
          and click away to see what it writes. An empty name is reverted rather
          than saved: it is the category's one required field, and blanking it
          would empty the left nav, the document heading and the home row at
          once. Game is deliberately read-only — it is fixed at creation, which
          is what lets game-specific categories resolve exactly once.
        </GalleryNote>
        <pre className="mt-3 font-mono text-xs text-gray-400 whitespace-pre-wrap">
          {log.length ? log.map(l => `→ ${l}`).join('\n') : '→ (no changes yet)'}
        </pre>
      </div>
    </div>
  );
};

/**
 * Rounds & Breaks driven by an in-memory store standing in for the four writes
 * it makes. The store enforces the same rule the DEFERRABLE unique constraint
 * does — ordinals must end up 0..n-1 with no duplicates — so a reorder bug
 * shows up here as a thrown error rather than silently.
 */
const RoundsBreaksFormDemo = () => {
  const pack: Pack = {
    id: 'demo', name: 'July RTT', game_id: 'g1', location_id: null,
    starts_on: null, ends_on: null, description: null, owner_id: 'u1',
    status: 'draft', slug: null, created_at: '', updated_at: '',
  };

  const [items, setItems] = useState<ScheduleItem[]>([
    { id: 'a', pack_id: 'demo', ordinal: 0, kind: 'break', label: 'Registration', starts_at: '10:00:00', ends_at: '10:30:00' },
    { id: 'b', pack_id: 'demo', ordinal: 1, kind: 'round', label: 'Round 1',      starts_at: '10:30:00', ends_at: '12:30:00' },
    { id: 'c', pack_id: 'demo', ordinal: 2, kind: 'break', label: 'Lunch',        starts_at: '12:30:00', ends_at: '13:15:00' },
    { id: 'd', pack_id: 'demo', ordinal: 3, kind: 'round', label: 'Round 2',      starts_at: '13:15:00', ends_at: '15:15:00' },
  ]);
  const [nextId, setNextId] = useState(1);
  const [problem, setProblem] = useState<string | null>(null);

  /** Same invariant the database holds, checked in the demo so bugs surface. */
  const assertContiguous = (next: ScheduleItem[]) => {
    const ordinals = next.map(i => i.ordinal).sort((x, y) => x - y);
    const ok = ordinals.every((o, i) => o === i);
    setProblem(ok ? null : `Ordinals are not 0..n-1: [${ordinals.join(', ')}]`);
  };

  const ops: ScheduleOps = {
    add: async (_packId, kind, ordinal, label) => {
      const id = `new-${nextId}`;
      setNextId(n => n + 1);
      setItems(prev => [...prev, { id, pack_id: 'demo', ordinal, kind, label, starts_at: null, ends_at: null }]);
    },
    update: async (id, patch) => {
      setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
    },
    remove: async (id) => {
      setItems(prev => prev.filter(i => i.id !== id));
    },
    reorder: async (ordered) => {
      const renumbered = ordered.map((item, i) => ({ ...item, ordinal: i }));
      setItems(renumbered);
      assertContiguous(renumbered);
    },
  };

  return (
    <div className="w-full flex flex-col gap-3 lg:flex-row">
      <div className="w-full lg:w-72 shrink-0 bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <RoundsBreaksForm
          pack={pack}
          rows={{}}
          schedule={items}
          games={[]}
          venues={[]}
          categoryKey="rounds-breaks"
          onChange={() => {}}
          reload={async () => {}}
          ops={ops}
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="font-body text-xs uppercase tracking-[1.2px] text-gray-500 mb-2">
            As the document renders it
          </p>
          <ScheduleTable
            rows={items.map(i => ({
              ordinal: i.ordinal,
              kind: i.kind,
              label: i.label ?? (i.kind === 'round' ? 'Round' : 'Break'),
              time: i.starts_at && i.ends_at ? `${i.starts_at.slice(0, 5)} - ${i.ends_at.slice(0, 5)}` : i.starts_at?.slice(0, 5),
            }))}
          />
        </div>

        {problem && <Callout flavour="bad">{problem}</Callout>}

        <GalleryNote>
          Reordering renumbers the whole day in one write rather than shuffling
          rows through spare ordinals. That works because the unique constraint
          on (pack_id, ordinal) is deferred to the end of the transaction, so the
          moment when two rows share a number never surfaces. Deleting closes the
          gap for the same reason — the document's numbering should have no holes
          in it. This demo asserts the same 0..n-1 invariant the database does and
          shouts if it breaks.
        </GalleryNote>
      </div>
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

      <GallerySection id="nav-event-basics-form" title="Event Basics Form">
        <EventBasicsFormDemo />
      </GallerySection>

      <GallerySection id="nav-rounds-breaks-form" title="Rounds & Breaks Form">
        <RoundsBreaksFormDemo />
      </GallerySection>

    </GalleryShell>
  );
};

export default ComponentGallery;
