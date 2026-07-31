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
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BuilderShell, ListPanel, EditorPanel, Tabs, Button, ButtonPair, Callout, HR, MarkdownBody, Modal,
  GAME_BANNERS, GAME_ICONS,
  StoreSelector,
  AddCircle, AltArrowDown, Calendar, InfoCircle, ListCheck, MapPin, Pen2, Play, Rocket, Trophy,
} from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import CategoryListItem from '../components/CategoryListItem';
import {
  PackHero, DocumentSection, DocumentRow, EmptySection, KeyInfoCard, ScheduleTable,
  sectionId,
} from '../components/PackDocument';
import {
  CATEGORY_TABS, CATEGORY_BY_KEY, visibleCategories, incompleteCategories,
} from '../registry/categories';
import type { CategoryContext, CategoryTab } from '../registry/categories';
import {
  getPack, getCategoryRows, getSchedule, updatePack, hideCategory, showCategory,
  listGames, listMyLocations, publishPack, unpublishPack, timeSchedule, bannerUrl,
} from '../lib/packs';
import AddCategoryModal from '../components/AddCategoryModal';
import { readChecklist } from '../components/forms/ChecklistSectionForm';
import { readFaq } from '../components/forms/FaqSectionForm';
import { readScheduleNotes } from '../components/forms/RoundsBreaksForm';
import { readTitledList } from '../components/forms/TitledListForm';
import PublishPanel from '../components/PublishPanel';
import LinkPreview from '../components/LinkPreview';
import type {
  GameOption, LocationOption, Pack, PackCategoryRow, ScheduleItem, ScheduleKind,
} from '../lib/packs';

/**
 * The left nav's Publish row. Deliberately not a registry key — Publish has no
 * document section and no storage, so making it a category would mean teaching
 * the registry about something that is neither.
 */
const PUBLISH_KEY = '__publish__';

/**
 * What a schedule row shows when the organiser has not named it.
 *
 * Only rounds get a number: they are the one kind that comes in a numbered
 * sequence, and "Break 2" would number the gaps as though anybody counted them.
 */
const SCHEDULE_FALLBACK: Record<ScheduleKind, { label: (ordinal: number) => string; icon: ReactNode }> = {
  round: { label: n => `Round ${n}`, icon: <Play className="w-4 h-4" /> },
  break: { label: () => 'Break',     icon: <ListCheck className="w-4 h-4" /> },
  event: { label: () => 'Event',     icon: <Trophy className="w-4 h-4" /> },
};

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
  // The pencil puts the left panel into edit mode, which is the only time the
  // bins appear. Destructive controls should be asked for, not always present.
  const [editingList, setEditingList] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, r, s, g, l] = await Promise.all([
          getPack(packId), getCategoryRows(packId), getSchedule(packId),
          listGames(), listMyLocations(),
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

  /**
   * Only the tabs that have something under them.
   *
   * Tickets, Registration and the FAQ are all optional, so a pack that has not
   * taken them leaves its tab pointing at nothing — and a tab you can press
   * that answers "no categories yet" is a worse result than no tab at all.
   *
   * Asking the question per TAB rather than per category is what gives
   * Registration its either-or for free: it survives on Tickets or on
   * Registration, and goes when both have gone.
   */
  const tabs = useMemo(
    () => CATEGORY_TABS.filter(t => categories.some(c => c.tab === t.id)),
    [categories],
  );

  /**
   * Removing the last category under the tab you are on would leave the panel
   * asking for a tab that is no longer rendered, which comes out blank — so the
   * shown tab falls back to the first one still standing.
   *
   * Derived rather than corrected in an effect: `activeTab` is read nowhere but
   * here, and adding a category runs through `selectCategory`, which sets the
   * tab itself. There is nothing for a stale value to spoil.
   */
  const shownTab = tabs.some(t => t.id === activeTab) ? activeTab : tabs[0]?.id ?? 'format';

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

  /**
   * Whether removing this category would throw work away.
   *
   * An untouched category costs nothing to remove and asking about it is noise;
   * one with prose or a schedule in it is a different question. The content is
   * kept either way — hiding never deletes — but "you can get it back" is not
   * obvious enough to skip the warning.
   */
  function hasContent(key: string): boolean {
    if (key === 'rounds-breaks') return schedule.length > 0;

    // The two categories that keep a list rather than prose are asked through
    // the same readers their forms use, so "is there anything in here" has one
    // answer per shape. Checking `content.body` alone silently under-reports
    // them — a full FAQ looked untouched and was removed without a word.
    if (key === 'faq') {
      return readFaq(rows[key]?.content).some(i => i.question.trim() || i.answer.trim());
    }
    if (key === 'what-to-bring') {
      return readChecklist(rows[key]?.content).some(i => i.text.trim() || i.url?.trim());
    }

    const content = rows[key]?.content as { body?: string; url?: string } | null | undefined;
    return Boolean(content?.body?.trim() || content?.url?.trim());
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

  /** Remove outright, or ask first if there is something to lose. */
  function requestRemove(key: string) {
    if (hasContent(key)) setConfirmRemove(key);
    else void removeCategory(key);
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

  /**
   * Key Info is NOT a category. It is a read-back of values the pack already
   * holds — the venue, the dates and time, the format — so it has no form, no
   * storage and no entry in the nav. Everything in it is entered in Event
   * Basics; asking for any of it twice would be asking for two answers.
   */
  const keyInfoRows = () => {
    const starts = formatDate(pack.starts_on);
    const ends   = formatDate(pack.ends_on);
    const time   = pack.starts_at ? formatTime(pack.starts_at) : null;

    const when = starts
      ? [starts, ends ? `– ${ends}` : null, time ? `at ${time}` : null].filter(Boolean).join(' ')
      : null;

    return [
      ...(venue ? [{
        icon: <MapPin className="w-4 h-4" />,
        text: `${venue.name}${venue.address ? `, ${venue.address}` : ''}`,
      }] : []),
      ...(when ? [{ icon: <Calendar className="w-4 h-4" />, text: when }] : []),
      ...(pack.format ? [{ icon: <InfoCircle className="w-4 h-4" />, text: pack.format }] : []),
    ];
  };

  /** What one category contributes to the document. */
  const bodyFor = (c: typeof categories[number]) => {
      let body;
      if (c.key === 'rounds-breaks') {
        // Times are worked out here rather than read from the row — an item
        // stores how long it lasts and nothing else, so a reorder cannot leave
        // the clock disagreeing with the order.
        const timed = timeSchedule(schedule, pack.starts_at);
        const notes = readScheduleNotes(rows[c.key]?.content);
        const table = schedule.length
          ? <ScheduleTable rows={schedule.map((s, i) => ({
              ordinal: s.ordinal,
              kind: s.kind,
              label: s.label ?? SCHEDULE_FALLBACK[s.kind]?.label(s.ordinal) ?? 'Break',
              time: timed[i] ? formatTimeRange(timed[i].startsAt, timed[i].endsAt) : `${s.duration_minutes} min`,
              icon: SCHEDULE_FALLBACK[s.kind]?.icon ?? <ListCheck className="w-4 h-4" />,
            }))} />
          : <EmptySection hint="No rounds or breaks yet." />;

        // Notes sit between the heading and the table — anything that applies to
        // the whole day is read before the day itself, not discovered under it.
        // Rendered only when written; an empty one adds a gap and nothing else.
        body = notes
          ? (
            <div className="flex flex-col gap-3">
              <MarkdownBody className="text-base leading-6 text-gray-300">{notes}</MarkdownBody>
              {table}
            </div>
          )
          : table;
      } else if (c.key === 'event-basics') {
        // The venue moved into Key Info, where the design shows it. This is
        // just the blurb now, which is why the document calls it About — and it
        // is markdown like every other prose field, so it renders as markdown.
        body = pack.description
          ? <MarkdownBody className="text-base leading-6 text-gray-300">{pack.description}</MarkdownBody>
          : <EmptySection hint="No description yet." />;
      } else if (c.key === 'what-to-bring') {
        // A bulleted list where an item with a link is clickable end to end —
        // the URL is a field, not something pasted mid-sentence, so the whole
        // phrase can carry it.
        const list = readChecklist(rows[c.key]?.content);
        body = list.length
          ? (
            <ul className="list-disc ps-5 space-y-1">
              {list.map((item, i) => (
                <li key={i}>
                  {item.url
                    ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary-400 hover:underline"
                      >
                        {item.text}
                      </a>
                    )
                    : item.text}
                </li>
              ))}
            </ul>
          )
          : <EmptySection hint={`Nothing in ${c.label} yet.`} />;
      } else if (c.key === 'prizes' || c.key === 'resources') {
        // A titled entry per row. The title carries the weight and the
        // description sits under it, so the section can be scanned by title
        // alone — which is how anyone reads a prize list.
        const entries = readTitledList(rows[c.key]?.content);
        body = entries.length
          ? (
            <div className="w-full flex flex-col gap-3">
              {entries.map((entry, i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  {/* Skipped when empty rather than rendered blank. Prizes
                      written before this was a list read back as one untitled
                      entry, and an empty bold line above them would be a gap
                      the organiser never put there. */}
                  {entry.title && (
                    <p className="font-body font-bold text-base leading-6 text-white">
                      {/* A resource's title is the link, so the clickable thing
                          is the name rather than a bare address. */}
                      {entry.url
                        ? (
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-primary-400 hover:underline"
                          >
                            {entry.title}
                          </a>
                        )
                        : entry.title}
                    </p>
                  )}
                  {entry.description && (
                    <MarkdownBody className="text-base leading-6 text-gray-300">
                      {entry.description}
                    </MarkdownBody>
                  )}
                </div>
              ))}
            </div>
          )
          : <EmptySection hint={`Nothing in ${c.label} yet.`} />;
      } else if (c.key === 'faq') {
        const faqs = readFaq(rows[c.key]?.content);
        // An accordion: an FAQ is scanned for the one question you have, so the
        // questions want to be a short list you read down, not a wall with the
        // answers between them.
        //
        // Native <details> rather than a state-driven component: it is keyboard
        // operable and announced as a disclosure without any ARIA of our own,
        // there is no "which one is open" to hold or get wrong, and find-in-page
        // still reaches an answer that is closed.
        body = faqs.length
          ? (
            <div className="w-full flex flex-col rounded-xl overflow-hidden border border-gray-700">
              {faqs.map((item, i) => (
                <details
                  key={i}
                  className="group border-b border-gray-700 last:border-b-0 bg-gray-800 open:bg-gray-900"
                >
                  <summary
                    className="flex items-start gap-2 px-4 py-3 cursor-pointer list-none
                               marker:content-none hover:bg-gray-700/40 transition-colors"
                  >
                    {/* Points the way it is about to go. */}
                    <AltArrowDown className="w-4 h-4 mt-1 shrink-0 text-primary-500 transition-transform group-open:rotate-180" />
                    <MarkdownBody className="flex-1 min-w-0 text-base leading-6 font-medium text-white">
                      {item.question}
                    </MarkdownBody>
                  </summary>

                  <div className="px-4 pb-3 ps-10">
                    <MarkdownBody className="text-base leading-6 text-gray-300">
                      {item.answer}
                    </MarkdownBody>
                  </div>
                </details>
              ))}
            </div>
          )
          : <EmptySection hint={`Nothing in ${c.label} yet.`} />;
      } else {
        // The remaining `section` categories hold markdown, so the document
        // renders it as markdown.
        const content = rows[c.key]?.content as { body?: string; url?: string } | null | undefined;
        body = content?.body || content?.url
          ? (
            <>
              {content.body && (
                <MarkdownBody className="text-base leading-6 text-gray-300">{content.body}</MarkdownBody>
              )}
              {/* A card showing what is on the other end, rather than the raw
                  address. Falls back to a plain link on its own when the page
                  gives up nothing — see LinkPreview. */}
              {content.url && <LinkPreview url={content.url} />}
            </>
          )
          : <EmptySection hint={`Nothing in ${c.label} yet.`} />;
      }
      return body;
  };

  /**
   * The tab's sections, with paired ones sharing a row.
   *
   * Grouping is done on the VISIBLE categories, so removing one half of a pair
   * leaves the other full width rather than half a row with a hole beside it.
   */
  const sectionsFor = (tab: CategoryTab) => {
    const inTab = categories.filter(c => c.tab === tab);

    const groups: (typeof categories)[] = [];
    for (const c of inTab) {
      const previous = groups[groups.length - 1];
      if (c.row && previous?.[0].row === c.row) previous.push(c);
      else groups.push([c]);
    }

    return groups.map(group => {
      const sections = group.map(c => (
        <div key={c.key} className={group.length > 1 ? 'flex-1 min-w-0' : ''}>
          <DocumentSection
            categoryKey={c.key}
            title={c.documentLabel ?? c.label}
            active={c.key === activeKey}
          >
            {bodyFor(c)}
          </DocumentSection>
        </div>
      ));

      // About pairs with the derived Key Info panel rather than with another
      // category — Key Info is a read-back, not something the organiser fills
      // in, so it has no registry entry to pair against.
      if (group.length === 1 && group[0].key === 'event-basics') {
        const info = keyInfoRows();
        return (
          <DocumentRow key="about+key-info">
            <div className="flex-1 min-w-0">{sections}</div>
            <div className="flex-1 min-w-0">
              <DocumentSection categoryKey="key-info" title="Key Info">
                {info.length
                  ? <KeyInfoCard rows={info} />
                  : <EmptySection hint="Set the venue, dates and format in Event Basics." />}
              </DocumentSection>
            </div>
          </DocumentRow>
        );
      }

      // A lone section needs no row wrapper, and giving it one would have
      // DocumentRow measuring a pair that does not exist.
      if (group.length === 1) return <div key={group[0].key}>{sections}</div>;

      return <DocumentRow key={group.map(c => c.key).join('+')}>{sections}</DocumentRow>;
    });
  };

  return (
    <BuilderShell
      navbar={
        <AppNavbar fixed={false}>
          {/* The pack's own store, not a picker — a pack cannot be moved
              between venues, since that would hand it to a different set of
              admins. */}
          {venue && <StoreSelector locations={[venue]} selectedId={venue.id} onSelect={() => {}} />}
        </AppNavbar>
      }
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
              onClick={() => setEditingList(v => !v)}
              title={editingList ? 'Done editing' : 'Edit categories'}
              aria-pressed={editingList}
              className={[
                'p-1 rounded cursor-pointer transition-colors',
                editingList
                  ? 'bg-primary-950 text-primary-400'
                  : 'hover:bg-gray-700 text-gray-400 hover:text-white',
              ].join(' ')}
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
              editing={editingList}
              /* Mandatory categories cannot be removed — no handler, no bin. */
              onRemove={c.requirement === 'mandatory' ? undefined : () => requestRemove(c.key)}
            />
          ))}

          {/* Publish sits at the end of the same list, but it is not a category:
              it has no document section and no storage. Selecting it swaps the
              right panel and leaves the document where it was. */}
          <CategoryListItem
            icon={<Rocket className="w-6 h-6" />}
            label="Publish"
            complete={pack.status === 'published'}
            active={activeKey === PUBLISH_KEY}
            onSelect={() => { setActiveKey(PUBLISH_KEY); setLeftOpen(false); }}
          />
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
              /* The organiser's own artwork wins the hero when they have
                 uploaded one; otherwise the game's banner stands in. */
              bannerImage={bannerUrl(pack.banner_path)}
              bannerAspect={pack.banner_aspect}
              /* The format reads as a second fact about the event, so it sits
                 beside the game in the same muted style rather than competing. */
              subtitle={pack.format}
            />

            {/* pt-5 on top of the hero's pb-6 — the gallery demo had this and
                the editor did not, so the two disagreed by 20px. */}
            <div className="px-5 pt-5 pb-5">
              {/* gap-10 on the sections: they are long-form prose and tables, so
                  they need more air between them than a list would.
                  No empty case — a tab is only here because it has sections. */}
              {tabs.length > 1 ? (
                <Tabs
                  variant="segmented"
                  activeTab={shownTab}
                  onTabChange={id => setActiveTab(id as CategoryTab)}
                  panelClassName="border-0 rounded-none p-0 pt-5"
                  tabs={tabs.map(t => ({
                    id: t.id,
                    label: t.label,
                    icon: t.icon,
                    content: <div className="flex flex-col gap-10">{sectionsFor(t.id)}</div>,
                  }))}
                />
              ) : (
                // One tab is not a choice. A lone full-width segmented button
                // looks like a control and does nothing when pressed, so the
                // sections stand on their own — the container's pt-5 leaves the
                // same gap under the hero that the bar did.
                <div className="flex flex-col gap-10">{sectionsFor(shownTab)}</div>
              )}
            </div>
          </div>
        </main>
      }

      rightPanelOpen={rightOpen}
      rightPanel={
        <EditorPanel title={activeKey === PUBLISH_KEY ? 'Publish' : activeDefinition?.label ?? 'Editor'}>
          {saveError && <Callout flavour="bad" onDismiss={() => setSaveError(null)}>{saveError}</Callout>}

          {activeKey === PUBLISH_KEY ? (
            <PublishPanel
              pack={pack}
              venueName={venue?.name}
              outstanding={outstanding}
              onSelectCategory={selectCategory}
              onPublish={async slug => { await publishPack(pack, slug); await reload(); }}
              onUnpublish={async () => { await unpublishPack(pack.id); await reload(); }}
            />
          ) : activeDefinition && ctx ? (
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
        <>
        {/* Only shown when there is work to lose — an untouched category is
            removed outright, because asking about nothing is noise. */}
        <Modal open={confirmRemove !== null} onClose={() => setConfirmRemove(null)} className="max-w-sm">
          <div className="flex flex-col gap-4 p-5">
            <h2 className="font-heading text-xl text-white">
              Remove {confirmRemove ? CATEGORY_BY_KEY[confirmRemove]?.label : 'this category'}?
            </h2>
            <p className="font-body text-sm text-gray-300">
              It has content in it. Removing takes it out of the pack but keeps what
              you wrote — add it back and the text returns.
            </p>
            <ButtonPair>
              <Button
                color="danger"
                onClick={() => { const key = confirmRemove; setConfirmRemove(null); if (key) void removeCategory(key); }}
              >
                Remove
              </Button>
              <Button variant="outline" color="secondary" onClick={() => setConfirmRemove(null)}>
                Keep it
              </Button>
            </ButtonPair>
          </div>
        </Modal>

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
        </>
      }
    />
  );
}
