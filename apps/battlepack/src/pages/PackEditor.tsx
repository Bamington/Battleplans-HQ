/**
 * PackEditor.tsx — the three-pane pack editor. Route: /app/:packId/edit
 *
 * Keyed by row id rather than slug on purpose: it is stable, it works for a
 * draft that has no slug yet, and it does not break when the slug is set on
 * first publish. The public page for a published pack is a separate thing at
 * the root — battlepack.app/<slug> — and is not built yet.
 *
 * LAYOUT comes from the shared <BuilderShell>: left <ListPanel>, a plain centre
 * slot, right <EditorPanel>. Below lg the two asides become draggable bottom
 * sheets, which the shell handles.
 *
 * SELECTION — the left nav is the sole source of truth. Clicking a category
 * sets it, switches the centre tab if that category lives under a different
 * one, and scrolls the document to its section.
 *
 * There is deliberately NO scroll-spy. Having the centre's scroll position also
 * drive the selection creates a feedback loop: the programmatic scroll fires the
 * spy, which re-selects, which re-scrolls. It is suppressible behind an
 * "animating" flag, but it is the loop-prone half of the interaction and is easy
 * to add later.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BuilderShell, ListPanel, EditorPanel, Tabs, Button, Callout, HR, MarkdownBody,
  GAME_BANNERS, GAME_ICONS,
  AddCircle, Calendar, ListCheck, MapPin, Pen2, Play,
} from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import CategoryListItem from '../components/CategoryListItem';
import {
  PackHero, DocumentSection, EmptySection, KeyInfoCard, ScheduleTable,
  DocumentMenuIcon, sectionId,
} from '../components/PackDocument';
import {
  CATEGORY_TABS, CATEGORY_BY_KEY, visibleCategories, incompleteCategories,
} from '../registry/categories';
import type { CategoryContext, CategoryTab } from '../registry/categories';
import {
  getPack, getCategoryRows, getSchedule, updatePack, hideCategory, showCategory,
  listGames, listLocations,
} from '../lib/packs';
import AddCategoryModal from '../components/AddCategoryModal';
import type { GameOption, LocationOption, Pack, PackCategoryRow, ScheduleItem } from '../lib/packs';

const formatDate = (iso?: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : null;
};

/** `time` columns arrive as HH:MM:SS; the document shows "10:00 AM - 12:00 PM". */
const formatTime = (t?: string | null) => {
  if (!t) return null;
  const [hRaw, m] = t.split(':');
  const h = Number(hRaw);
  if (Number.isNaN(h)) return null;
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m} ${suffix}`;
};

const formatTimeRange = (from?: string | null, to?: string | null) => {
  const a = formatTime(from);
  const b = formatTime(to);
  return a && b ? `${a} - ${b}` : a ?? b;
};

export default function PackEditor() {
  const { packId = '' } = useParams();
  const navigate = useNavigate();

  const [pack,     setPack]     = useState<Pack | null>(null);
  const [rows,     setRows]     = useState<Record<string, PackCategoryRow>>({});
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [games,    setGames]    = useState<GameOption[]>([]);
  const [venues,   setVenues]   = useState<LocationOption[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  // Separate from `error`: a failed save should surface in the panel, not
  // replace the whole editor with an error screen.
  const [saveError, setSaveError] = useState<string | null>(null);

  const [activeKey,  setActiveKey]  = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<CategoryTab>('format');
  const [leftOpen,   setLeftOpen]   = useState(false);
  const [rightOpen,  setRightOpen]  = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, r, s, g, l] = await Promise.all([
          getPack(packId), getCategoryRows(packId), getSchedule(packId),
          listGames(), listLocations(),
        ]);
        if (cancelled) return;
        if (!p) { setError('That pack does not exist, or you cannot open it.'); return; }
        setPack(p); setRows(r); setSchedule(s); setGames(g); setVenues(l);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the pack.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [packId]);

  /**
   * Re-read everything a form may have written outside the pack row. Cheap
   * enough at this scale, and it means a form never has to tell the editor
   * which of its slices changed.
   */
  const reload = useCallback(async () => {
    const [p, r, s] = await Promise.all([
      getPack(packId), getCategoryRows(packId), getSchedule(packId),
    ]);
    if (p) setPack(p);
    setRows(r);
    setSchedule(s);
  }, [packId]);

  const categories = useMemo(
    () => (pack ? visibleCategories(pack.game_id, rows) : []),
    [pack, rows],
  );

  // Select the first category once the registry has resolved for this pack.
  useEffect(() => {
    if (!activeKey && categories.length) setActiveKey(categories[0].key);
  }, [categories, activeKey]);

  const ctx: CategoryContext | null = pack ? { pack, rows, schedule, games, venues } : null;
  const game  = games.find(g => g.id === pack?.game_id) ?? null;
  const venue = venues.find(v => v.id === pack?.location_id) ?? null;

  /**
   * Game artwork comes from the shared maps keyed by slug, with the database
   * columns only as a fallback. `games.icon` and `games.image` are empty for
   * most of the catalogue, so reading them alone left the hero with no icon.
   */
  const gameArt = {
    icon:   game ? GAME_ICONS[game.slug]   ?? game.icon  : null,
    banner: game ? GAME_BANNERS[game.slug] ?? game.image : null,
  };

  /**
   * The one place selection changes. Switching tab before scrolling matters:
   * the target section is not in the DOM until its tab is showing, so the
   * scroll has to wait a frame for React to commit the tab change.
   */
  const selectCategory = useCallback((key: string) => {
    const definition = CATEGORY_BY_KEY[key];
    if (!definition) return;

    setActiveKey(key);
    setActiveTab(definition.tab);
    setLeftOpen(false);          // below lg the nav is a sheet over the document

    requestAnimationFrame(() => {
      document.getElementById(sectionId(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  /**
   * The single write path for `core`-storage categories.
   *
   * Optimistic: the panel and the document both read from `pack`, so waiting
   * for the round trip would leave a field visibly stale after every blur. A
   * failed save reverts and says so, rather than leaving the screen showing
   * something the database does not hold.
   */
  const savePackFields = useCallback(async (patch: Record<string, unknown>) => {
    setPack(prev => (prev ? { ...prev, ...patch } as Pack : prev));
    setSaveError(null);
    try {
      await updatePack(packId, patch as Partial<Pack>);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save that change.');
      const fresh = await getPack(packId).catch(() => null);
      if (fresh) setPack(fresh);
    }
  }, [packId]);

  async function renamePack(next: string) {
    const name = next.trim();
    setEditingName(false);
    if (!pack || !name || name === pack.name) return;
    await savePackFields({ name });
  }

  async function removeCategory(key: string) {
    if (!pack) return;
    await hideCategory(pack.id, key);
    setRows(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { pack_id: pack.id, category_key: key, sort_order: null, content: null }), hidden: true },
    }));
    if (activeKey === key) setActiveKey(null);
  }

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col h-dvh bg-gray-950">
        <AppNavbar fixed={false} />
        <div className="flex-1 flex items-center justify-center font-body text-gray-500">Loading pack…</div>
      </div>
    );
  }

  if (error || !pack || !ctx) {
    return (
      <div className="flex flex-col h-dvh bg-gray-950">
        <AppNavbar fixed={false} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md flex flex-col gap-4">
            <Callout flavour="bad">{error ?? 'Pack not found.'}</Callout>
            <Button variant="outline" onClick={() => navigate('/app')}>Back to my packs</Button>
          </div>
        </div>
      </div>
    );
  }

  const outstanding = incompleteCategories(ctx);
  const activeDefinition = activeKey ? CATEGORY_BY_KEY[activeKey] : undefined;

  // ── Document ───────────────────────────────────────────────────────────────
  const sectionsFor = (tab: CategoryTab) =>
    categories.filter(c => c.tab === tab).map(c => {
      let body;
      if (c.key === 'event-timeline') {
        const starts = formatDate(pack.starts_on);
        const ends   = formatDate(pack.ends_on);
        body = starts
          ? <KeyInfoCard rows={[{ icon: <Calendar className="w-4 h-4" />, text: ends ? `${starts} – ${ends}` : starts }]} />
          : <EmptySection hint="No dates set yet." />;
      } else if (c.key === 'rounds-breaks') {
        body = schedule.length
          ? <ScheduleTable rows={schedule.map(s => ({
              ordinal: s.ordinal,
              kind: s.kind,
              label: s.label ?? (s.kind === 'round' ? `Round ${s.ordinal}` : 'Break'),
              time: formatTimeRange(s.starts_at, s.ends_at),
              icon: s.kind === 'round'
                ? <Play className="w-4 h-4" />
                : <ListCheck className="w-4 h-4" />,
            }))} />
          : <EmptySection hint="No rounds or breaks yet." />;
      } else if (c.key === 'event-basics') {
        // Venue lives here rather than under Event Timeline because it is an
        // Event Basics field — the dates are the timeline's business.
        body = (
          <>
            {pack.description
              ? <p className="whitespace-pre-wrap">{pack.description}</p>
              : <EmptySection hint="No description yet." />}
            {venue && (
              <KeyInfoCard rows={[{
                icon: <MapPin className="w-4 h-4" />,
                text: `${venue.name}${venue.address ? `, ${venue.address}` : ''}`,
              }]} />
            )}
          </>
        );
      } else {
        // `section` categories hold markdown, so the document renders it as
        // markdown — that is what gives the design's bulleted lists.
        const content = rows[c.key]?.content as { body?: string } | null | undefined;
        body = content?.body
          ? <MarkdownBody className="text-base leading-6 text-gray-300">{content.body}</MarkdownBody>
          : <EmptySection hint={`Nothing in ${c.label} yet.`} />;
      }

      return (
        <DocumentSection key={c.key} categoryKey={c.key} title={c.label} active={c.key === activeKey}>
          {body}
        </DocumentSection>
      );
    });

  return (
    <BuilderShell
      navbar={<AppNavbar fixed={false} />}
      topBar={
        <div className="lg:hidden shrink-0 px-3 py-2 flex gap-2 bg-gray-900 border-b border-gray-700">
          <Button size="sm" variant="outline" onClick={() => { setLeftOpen(o => !o); setRightOpen(false); }}>
            Categories
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setRightOpen(o => !o); setLeftOpen(false); }}>
            Edit
          </Button>
        </div>
      }

      leftPanelOpen={leftOpen}
      leftPanel={
        <ListPanel
          title={pack.name}
          editingTitle={editingName}
          inputRef={nameInputRef}
          onStartEdit={() => {
            setEditingName(true);
            requestAnimationFrame(() => nameInputRef.current?.select());
          }}
          onCommit={renamePack}
          onCancelEdit={() => setEditingName(false)}
          headerSubtitle={
            <p className="font-body text-xs font-bold text-gray-500 uppercase tracking-[1.2px] truncate">
              {game?.name ?? '—'}
            </p>
          }
          headerAction={
            <button
              type="button"
              onClick={() => {
                setEditingName(true);
                requestAnimationFrame(() => nameInputRef.current?.select());
              }}
              title="Rename pack"
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white cursor-pointer"
            >
              <Pen2 className="w-4 h-4" />
            </button>
          }
          footer={
            <>
              <HR />
              {/* A running count of what still blocks publishing. Publish itself
                  is a later phase; this is the same rule it will use — every
                  mandatory category plus every added, non-hidden optional one. */}
              <p className="font-body text-xs text-gray-500">
                {outstanding.length === 0
                  ? 'Every category is complete.'
                  : `${outstanding.length} categor${outstanding.length === 1 ? 'y' : 'ies'} still to finish.`}
              </p>
              <Button
                variant="outline"
                leftIcon={<AddCircle className="w-4 h-4" />}
                className="w-full"
                onClick={() => setAddingCategory(true)}
              >
                Add Category
              </Button>
            </>
          }
        >
          {categories.map(c => (
            <CategoryListItem
              key={c.key}
              icon={c.icon}
              label={c.label}
              complete={c.isComplete(ctx)}
              active={c.key === activeKey}
              onSelect={() => selectCategory(c.key)}
              /* Mandatory categories cannot be removed — no handler, no ×. */
              onRemove={c.requirement === 'mandatory' ? undefined : () => removeCategory(c.key)}
            />
          ))}
        </ListPanel>
      }

      center={
        <main className="flex-1 min-w-0 overflow-y-auto lg:order-2 p-4">
          <div className="mx-auto w-full max-w-4xl bg-gray-800 border border-gray-700 rounded-lg shadow-md overflow-hidden">
            <PackHero
              name={pack.name}
              gameName={game?.name}
              /* Shared artwork maps first — games.icon / games.image are empty
                 for most of the catalogue, which is why the icon was missing. */
              gameIcon={gameArt.icon}
              gameImage={gameArt.banner}
              gameLogo={gameArt.banner}
              menu={<DocumentMenuIcon />}
            />

            <div className="px-5 pb-5">
              <Tabs
                variant="segmented"
                activeTab={activeTab}
                onTabChange={id => setActiveTab(id as CategoryTab)}
                panelClassName="border-0 rounded-none p-0 pt-5"
                tabs={CATEGORY_TABS.map(t => ({
                  id: t.id,
                  label: t.label,
                  icon: t.icon,
                  // gap-10: sections are long-form prose and tables, so they
                  // need more air between them than a list would.
                  content: (
                    <div className="flex flex-col gap-10">
                      {sectionsFor(t.id).length
                        ? sectionsFor(t.id)
                        : <EmptySection hint="No categories under this tab yet." />}
                    </div>
                  ),
                }))}
              />
            </div>
          </div>
        </main>
      }

      rightPanelOpen={rightOpen}
      rightPanel={
        <EditorPanel title={activeDefinition?.label ?? 'Editor'}>
          {saveError && <Callout flavour="bad" onDismiss={() => setSaveError(null)}>{saveError}</Callout>}

          {activeDefinition && ctx ? (
            <activeDefinition.Form
              {...ctx}
              categoryKey={activeDefinition.key}
              onChange={savePackFields}
              reload={reload}
            />
          ) : (
            <p className="font-body text-sm text-gray-500">Pick a category on the left.</p>
          )}
        </EditorPanel>
      }

      onClosePanels={() => { setLeftOpen(false); setRightOpen(false); }}

      modals={
        <AddCategoryModal
          open={addingCategory}
          onClose={() => setAddingCategory(false)}
          gameId={pack.game_id}
          rows={rows}
          onAdd={async key => {
            await showCategory(pack.id, key);
            await reload();
            // Land on what was just added, rather than leaving the organiser to
            // find it in the list themselves.
            selectCategory(key);
          }}
        />
      }
    />
  );
}
