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
  AddCircle,
  Button,
  Callout,
  Calendar,
  FileText,
  GAME_BANNERS,
  GAME_ICONS,
  Gallery,
  MarkdownBody,
  ListCheck,
  MapPin,
  InfoCircle,
  MenuDots,
  Rocket,
  Notebook,
  Play,
  Tabs,
  Widget2,
  type GalleryNavItem,
} from '@battleplans/ui';

import AppNavbar from '../components/AppNavbar';
import AddCategoryModal from '../components/AddCategoryModal';
import PublishPanel from '../components/PublishPanel';
import CategoryListItem from '../components/CategoryListItem';
import BattlepackListItem from '../components/BattlepackListItem';
import {
  PackHero, DocumentSection, DocumentRow, EmptySection, KeyInfoCard, ScheduleTable,
} from '../components/PackDocument';
import EventBasicsForm from '../components/forms/EventBasicsForm';
import RoundsBreaksForm from '../components/forms/RoundsBreaksForm';
import SectionForm from '../components/forms/SectionForm';
import type { SaveSection } from '../components/forms/SectionForm';
import type { ScheduleOps } from '../components/forms/RoundsBreaksForm';
import { CATEGORY_REGISTRY, visibleCategories } from '../registry/categories';
import { timeSchedule } from '../lib/packs';
import type { GameOption, LocationOption, Pack, PackCategoryRow, ScheduleItem } from '../lib/packs';

// ── Local nav ────────────────────────────────────────────────────────────────

/** Sidebar entries for this app's own sections, appended after the shared ones. */
const LOCAL_NAV: GalleryNavItem[] = [
  { href: '#nav-navbar',              label: 'Navbar',               icon: <Widget2 className="w-5 h-5" /> },
  { href: '#nav-category-list-item',  label: 'Category List Item',   icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-battlepack-list-item', label: 'Battlepack List Item', icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-document-row',        label: 'Paired Rows',          icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-pack-document',       label: 'Pack Document',        icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-event-basics-form',   label: 'Event Basics Form',    icon: <FileText className="w-5 h-5" /> },
  { href: '#nav-rounds-breaks-form',  label: 'Rounds & Breaks Form', icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-add-category',        label: 'Add Category',         icon: <AddCircle className="w-5 h-5" /> },
  { href: '#nav-section-form',        label: 'Section Form',         icon: <FileText className="w-5 h-5" /> },
  { href: '#nav-publish-panel',       label: 'Publish Panel',        icon: <Rocket className="w-5 h-5" /> },
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
    starts_on: null, ends_on: null, starts_at: '10:00:00', format: null, description: null, owner_id: 'u1',
    status: 'draft', slug: null, created_at: '', updated_at: '',
  });
  const [log, setLog] = useState<string[]>([]);

  const games: GameOption[]     = [{ id: 'g1', name: 'Warhammer 40,000', slug: 'warhammer-40-000', icon: null, image: null }];
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
    starts_on: null, ends_on: null, starts_at: '10:00:00', format: null, description: null, owner_id: 'u1',
    status: 'draft', slug: null, created_at: '', updated_at: '',
  };

  const [items, setItems] = useState<ScheduleItem[]>([
    { id: 'a', pack_id: 'demo', ordinal: 0, kind: 'break', label: 'Registration', duration_minutes: 30 },
    { id: 'b', pack_id: 'demo', ordinal: 1, kind: 'round', label: 'Round 1',      duration_minutes: 30 },
    { id: 'c', pack_id: 'demo', ordinal: 2, kind: 'break', label: 'Lunch',        duration_minutes: 30 },
    { id: 'd', pack_id: 'demo', ordinal: 3, kind: 'round', label: 'Round 2',      duration_minutes: 30 },
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
      setItems(prev => [...prev, { id, pack_id: 'demo', ordinal, kind, label, duration_minutes: kind === 'round' ? 120 : 10 }]);
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
          {/* Times worked out from the pack's start and each length, exactly as
              the document does it — nothing here reads a stored time. */}
          <ScheduleTable
            rows={timeSchedule(items, pack.starts_at).map(i => ({
              ordinal: i.ordinal,
              kind: i.kind,
              label: i.label ?? (i.kind === 'round' ? 'Round' : 'Break'),
              time: `${i.startsAt.slice(0, 5)} - ${i.endsAt.slice(0, 5)}`,
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

/**
 * The Add Category picker over an in-memory row set, so adding and hiding are
 * both exercisable without a session. Hide a category, then reopen the picker:
 * it comes back flagged as still holding content, which is the one thing this
 * picker exists to show.
 */
const AddCategoryModalDemo = () => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, PackCategoryRow>>({
    // Hidden earlier, with prose still on it.
    faq: { pack_id: 'demo', category_key: 'faq', hidden: true, sort_order: null, content: { body: 'Can I proxy?' } },
    // Hidden earlier, never written to.
    tickets: { pack_id: 'demo', category_key: 'tickets', hidden: true, sort_order: null, content: null },
  });

  const visible = visibleCategories('g1', rows);

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" leftIcon={<AddCircle className="w-4 h-4" />} onClick={() => setOpen(true)}>
          Add Category
        </Button>
        <span className="font-body text-xs text-gray-500">
          Showing: {visible.map(c => c.label).join(', ')}
        </span>
      </div>

      <AddCategoryModal
        open={open}
        onClose={() => setOpen(false)}
        gameId="g1"
        rows={rows}
        onAdd={async key => {
          setRows(prev => ({
            ...prev,
            [key]: { ...(prev[key] ?? { pack_id: 'demo', category_key: key, sort_order: null, content: null }), hidden: false },
          }));
        }}
      />

      <div className="flex flex-wrap gap-1.5">
        {visible.filter(c => c.requirement !== 'mandatory').map(c => (
          <Button
            key={c.key}
            size="sm"
            variant="ghost"
            color="secondary"
            onClick={() => setRows(prev => ({
              ...prev,
              [c.key]: { ...(prev[c.key] ?? { pack_id: 'demo', category_key: c.key, sort_order: null, content: null }), hidden: true },
            }))}
          >
            Hide {c.label}
          </Button>
        ))}
      </div>

      <GalleryNote>
        Only categories the pack could still show appear, filtered by its game.
        FAQ starts hidden with prose still on it, so it is flagged{' '}
        <strong>Has saved content</strong> — hiding a category keeps what was
        written, and without that flag re-adding one would silently resurface
        text the organiser had forgotten. Tickets starts hidden and empty, so it
        carries no flag. Hide a category with the buttons above and reopen the
        picker to watch it reappear.
      </GalleryNote>
    </div>
  );
};

/**
 * A section category end to end: the markdown editor on the left, and the same
 * content as the document renders it on the right. Writes go to local state, so
 * the debounce and the switch-away flush are both watchable.
 */
const SectionFormDemo = () => {
  const pack: Pack = {
    id: 'demo', name: 'July RTT', game_id: 'g1', location_id: null,
    starts_on: null, ends_on: null, starts_at: '10:00:00', format: null, description: null, owner_id: 'u1',
    status: 'draft', slug: null, created_at: '', updated_at: '',
  };

  const [which, setWhich] = useState('faq');
  const [rows, setRows]   = useState<Record<string, PackCategoryRow>>({
    faq: {
      pack_id: 'demo', category_key: 'faq', hidden: false, sort_order: null,
      content: { body: '**Can I proxy?**\n\nYes, as long as it is clearly the right size.' },
    },
  });
  const [writes, setWrites] = useState(0);

  const save: SaveSection = async (_packId, key, content) => {
    setWrites(n => n + 1);
    setRows(prev => ({
      ...prev,
      [key]: { pack_id: 'demo', category_key: key, hidden: false, sort_order: null, content },
    }));
  };

  const stored = (rows[which]?.content as { body?: string } | null | undefined)?.body ?? '';

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {['faq', 'prizes', 'tickets'].map(key => (
          <Button
            key={key}
            size="sm"
            variant={which === key ? 'filled' : 'outline'}
            color="secondary"
            onClick={() => setWhich(key)}
          >
            {CATEGORY_REGISTRY.find(c => c.key === key)?.label}
          </Button>
        ))}
        <span className="font-body text-xs text-gray-500">writes: {writes}</span>
      </div>

      <div className="w-full flex flex-col gap-3 lg:flex-row">
        <div className="w-full lg:w-80 shrink-0 bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          {/* Keyed on the category so switching remounts, which is exactly what
              the real editor does and what the unmount flush has to survive. */}
          <SectionForm
            key={which}
            pack={pack}
            rows={rows}
            schedule={[]}
            games={[]}
            venues={[]}
            categoryKey={which}
            reload={async () => {}}
            onChange={() => {}}
            save={save}
          />
        </div>

        <div className="flex-1 min-w-0 bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="font-body text-xs uppercase tracking-[1.2px] text-gray-500 mb-2">
            As the document renders it
          </p>
          {stored
            ? <MarkdownBody className="text-base leading-6 text-gray-300">{stored}</MarkdownBody>
            : <p className="font-body text-sm text-gray-500 italic">Nothing here yet.</p>}
        </div>
      </div>

      <GalleryNote>
        Every section category shares this one form and differs only in the
        guidance the registry hands it — switch between the three above to see
        the hint and placeholder change. Saving is debounced a second after the
        last keystroke rather than on blur, because a rich text editor loses
        focus for ordinary reasons like reaching for the bold button. Switching
        category unmounts the form, so a pending write is flushed on the way out:
        type something and immediately click another category, and the write
        counter still moves.
      </GalleryNote>
    </div>
  );
};

/**
 * The publish step over a stub pack, with the availability check answered from
 * a fixed set of taken slugs. Toggle the outstanding categories to watch the
 * gate open and close.
 */
const PublishPanelDemo = () => {
  const TAKEN = ['july-rtt', 'season-6-league'];

  const [pack, setPack] = useState<Pack>({
    id: 'demo', name: 'July RTT', game_id: 'g1', location_id: 'v1',
    starts_on: '2026-06-13', ends_on: null, starts_at: '10:00:00', format: null, description: null, owner_id: 'u1',
    status: 'draft', slug: null, created_at: '', updated_at: '',
  });
  const [blocked, setBlocked] = useState(true);

  const outstanding = blocked
    ? CATEGORY_REGISTRY.filter(c => ['event-timeline', 'key-info'].includes(c.key))
    : [];

  return (
    <div className="w-full flex flex-col gap-3 lg:flex-row">
      <div className="w-full lg:w-80 shrink-0 bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <PublishPanel
          pack={pack}
          venueName="Gaming Arena"
          outstanding={outstanding}
          onSelectCategory={() => {}}
          checkSlug={async candidate => !TAKEN.includes(candidate.trim().toLowerCase())}
          onPublish={async slug => setPack(p => ({ ...p, status: 'published', slug }))}
          onUnpublish={async () => setPack(p => ({ ...p, status: 'unpublished' }))}
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" color="secondary" onClick={() => setBlocked(b => !b)}>
            {blocked ? 'Mark everything complete' : 'Leave two categories unfinished'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            color="secondary"
            onClick={() => setPack(p => ({ ...p, status: 'draft', slug: null }))}
          >
            Reset to draft
          </Button>
        </div>

        <pre className="font-mono text-xs text-gray-400 whitespace-pre-wrap">
          {`status: ${pack.status}\nslug:   ${pack.slug ?? '(none)'}`}
        </pre>

        <GalleryNote>
          Two gates: every category complete, and a URL nobody has taken.
          <code>july-rtt</code> and <code>season-6-league</code> are taken in this
          demo, so the name's own suggestion is refused — try{' '}
          <code>july-rtt-2026</code>. Publish, and the field locks: a published URL
          never moves and is never reused, not by another pack and not after this
          one is deleted, which is why the organiser gets to see and edit it before
          committing. Unpublishing keeps the slug — the URL then says the event is
          not currently available rather than that it never existed. Nothing here
          claims the event is live, because V1 has no public page: publishing
          reserves the URL and nothing more.
        </GalleryNote>
      </div>
    </div>
  );
};

/**
 * Two paired sections whose balance can be changed on the spot, so the rule
 * that abandons the pair is watchable rather than described.
 */
const DocumentRowDemo = () => {
  const SHORT = 'Join us at The Gaming Arena for a one-day tournament.';
  const LONG  = Array.from({ length: 8 }, (_, i) =>
    `Paragraph ${i + 1}. This is the sort of length an organiser actually writes when they are excited about their event, and it is exactly what leaves a column of nothing beside a three-row Key Info card.`,
  ).join('\n\n');

  const [long, setLong] = useState(false);

  return (
    <div className="w-full flex flex-col gap-3">
      <Button size="sm" variant="outline" color="secondary" onClick={() => setLong(v => !v)}>
        {long ? 'Shorten the About section' : 'Lengthen the About section'}
      </Button>

      <div className="w-full bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <DocumentRow>
          <div className="flex-1 min-w-0">
            <DocumentSection categoryKey="demo-row-about" title="About">
              <MarkdownBody className="text-base leading-6 text-gray-300">
                {long ? LONG : SHORT}
              </MarkdownBody>
            </DocumentSection>
          </div>
          <div className="flex-1 min-w-0">
            <DocumentSection categoryKey="demo-row-key" title="Key Info">
              <KeyInfoCard
                rows={[
                  { icon: <MapPin className="w-4 h-4" />,   text: '2/86 Cottrell Street, Werribee, VIC' },
                  { icon: <Calendar className="w-4 h-4" />, text: 'Saturday, 13/06/26' },
                ]}
              />
            </DocumentSection>
          </div>
        </DocumentRow>
      </div>

      <GalleryNote>
        Side by side reads well when the halves are comparable, and badly when
        one is six lines taller than the other — that is a column of nothing, not
        breathing room. Past that threshold the row gives up on the pair and both
        take the full width. The awkward part is not measuring but not
        oscillating: stacking makes the tall side wider and so shorter, which
        would satisfy the opposite condition forever. The decision is therefore
        only ever taken from a paired measurement, and the row returns to paired
        before re-measuring. Resize the window to watch it re-decide; it ignores
        its own height changes on purpose.
      </GalleryNote>
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

      <GallerySection id="nav-document-row" title="Pack Document / Paired Rows">
        <DocumentRowDemo />
      </GallerySection>

      <GallerySection id="nav-pack-document" title="Pack Document">
        {/* gray-800 on gray-700 with a shadow — the card sits forward of the
            gray-950 page behind it, not level with it. */}
        <div className="w-full max-w-2xl bg-gray-800 border border-gray-700 rounded-lg shadow-md overflow-hidden">
          <PackHero
            name="July RTT"
            gameName="Warhammer 40,000"
            gameIcon={GAME_ICONS['warhammer-40-000']}
            gameImage={GAME_BANNERS['warhammer-40-000']}
            gameLogo={GAME_BANNERS['warhammer-40-000']}
            subtitle="2000 Points"
            menu={<MenuDots className="w-4 h-4" />}
          />

          <div className="px-5 pt-5">
            <Tabs
              variant="segmented"
              tabs={[
                { id: 'format',       label: 'Event Format', icon: <InfoCircle className="w-4 h-4" />, content: <></> },
                { id: 'registration', label: 'Registration',  icon: <MapPin className="w-4 h-4" />,     content: <></> },
                { id: 'faq',          label: 'FAQ',           icon: <Notebook className="w-4 h-4" />,   content: <></> },
              ]}
              panelClassName="border-0 rounded-none p-0"
            />
          </div>

          <div className="px-5 pb-5 flex flex-col gap-10">
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
                  { ordinal: 0, kind: 'break', label: 'Registration', time: '10:00 AM - 12:00 PM', icon: <Notebook className="w-4 h-4" /> },
                  { ordinal: 1, kind: 'round', label: 'Round 1',      time: '12:00 PM - 2:00 PM', icon: <Play className="w-4 h-4" /> },
                  { ordinal: 2, kind: 'break', label: 'Break',        time: '2:00 PM - 2:30 PM', icon: <ListCheck className="w-4 h-4" /> },
                  { ordinal: 3, kind: 'round', label: 'Round 2',      time: '2:30 PM - 4:30 PM', icon: <Play className="w-4 h-4" /> },
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

      <GallerySection id="nav-add-category" title="Add Category">
        <AddCategoryModalDemo />
      </GallerySection>

      <GallerySection id="nav-section-form" title="Section Form">
        <SectionFormDemo />
      </GallerySection>

      <GallerySection id="nav-publish-panel" title="Publish Panel">
        <PublishPanelDemo />
      </GallerySection>

    </GalleryShell>
  );
};

export default ComponentGallery;
