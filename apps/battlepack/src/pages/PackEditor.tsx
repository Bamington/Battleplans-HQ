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
  BuilderShell, ListPanel, EditorPanel, Tabs, Button, ButtonPair, Callout, HR, Modal,
  GAME_BANNERS, GAME_ICONS,
  StoreSelector,
  AddCircle, Pen2, Rocket,
} from '@battleplans/ui';
import AppNavbar from '../components/AppNavbar';
import CategoryListItem from '../components/CategoryListItem';
import {
  PackHero, DocumentSection, DocumentRow, EmptySection, KeyInfoCard, sectionId,
} from '../components/PackDocument';
import {
  CATEGORY_TABS, CATEGORY_BY_KEY, visibleCategories, incompleteCategories,
} from '../registry/categories';
import type { CategoryContext, CategoryTab } from '../registry/categories';
import {
  getPack, getCategoryRows, getSchedule, getSegments, updatePack, hideCategory, showCategory,
  listGames, listMyLocations, publishPack, unpublishPack, bannerUrl,
  listMyClubs, calendarAudienceSize, pendingNotifyCount, updateSegment, addSegment, deleteSegment,
} from '../lib/packs';
import AddCategoryModal from '../components/AddCategoryModal';
import { categoryBody, formatDate, formatTime, keyInfoRows as keyInfoRowsShared } from '../components/packBody';
// Still needed here, by hasContent() rather than by the document rendering.
import { readChecklist } from '../components/forms/ChecklistSectionForm';
import { readFaq } from '../components/forms/FaqSectionForm';
import PublishPanel from '../components/PublishPanel';
import type {
  GameOption, LocationOption, Pack, PackCategoryRow, PackTimeline, ScheduleItem, ScheduleSegment,
} from '../lib/packs';

/**
 * The left nav's Publish row. Deliberately not a registry key — Publish has no
 * document section and no storage, so making it a category would mean teaching
 * the registry about something that is neither.
 */
const PUBLISH_KEY = '__publish__';

/**
 * Below this, BuilderShell's two asides are drawers rather than columns.
 *
 * Kept in sync with the shell's own `lg:` breakpoint by hand — it expresses the
 * split in Tailwind variants, which cannot be read back from JS. This is
 * BattlePack's rule and not the shell's: BattleCards keeps its list open while
 * you pick through cards, whereas a pack category and its form are one thing,
 * and on a phone showing the list instead of the form means every edit costs
 * two taps.
 */
const DRAWER_MQ = '(max-width: 1023px)';
const panelsAreDrawers = () =>
  typeof window !== 'undefined' && window.matchMedia(DRAWER_MQ).matches;

/**
 * The SEGMENT columns whose change emails everyone holding a calendar entry.
 *
 * These are what `battlepack_schedule_signature` hashes, and the two lists have
 * to say the same thing: the signature decides who is written to, and this
 * decides who is warned first. A warning that has not kept up is worse than
 * none, because it teaches an organiser that saving a date is safe right up
 * until the time it is not.
 *
 * A day's `ends_at` is deliberately absent from both — settled with Chris, on
 * the grounds that people block out the whole day anyway.
 */
const NOTIFYING_FIELDS = ['starts_on', 'starts_at'];

/** "1 person" / "4 people" — the sentence reads badly with a bare count. */
const people = (n: number) => (n === 1 ? '1 person' : `${n} people`);

/** Something that would destroy days, held until the organiser confirms it. */
interface ConfirmDays {
  title: string;
  body: string;
  confirmLabel: string;
  run: () => Promise<void>;
}

/** A change that would email people, held until the organiser confirms it. */
interface PendingNotify {
  kind: 'moved' | 'withdrawn';
  count: number;
  /** What the event's date becomes. Shown for a move; absent otherwise. */
  becomes?: string;
  run: () => Promise<void>;
}

/**
 * A day's date line as it WOULD read, given a patch that has not been written.
 *
 * The confirmation is the only place this is visible. The date field is
 * controlled by the segment, which is deliberately not updated until the
 * organiser confirms — so React restores the input to the old value the moment
 * the modal goes up, and a dialog that did not name the new date would be
 * asking "are you sure?" about something no longer on screen.
 */
const whenAfterDay = (day: ScheduleSegment, patch: Partial<ScheduleSegment>): string => {
  const next   = { ...day, ...patch };
  const starts = formatDate(next.starts_on);
  const ends   = next.ends_on && next.ends_on !== next.starts_on ? formatDate(next.ends_on) : null;
  const time   = next.starts_at ? formatTime(next.starts_at) : null;
  return [starts, ends ? `– ${ends}` : null, time ? `at ${time}` : null]
    .filter(Boolean).join(' ') || 'no date';
};

/**
 * The same, for a patch to the pack row itself.
 *
 * Nothing on the pack notifies any more — dates moved to segments — but the
 * confirmation path is kept whole rather than half-removed, so a notifying pack
 * column added later finds the machinery still here.
 */
const whenAfter = (pack: Pack, patch: Record<string, unknown>): string => {
  const next   = { ...pack, ...patch } as Pack;
  const starts = formatDate(next.starts_on);
  const ends   = next.ends_on && next.ends_on !== next.starts_on ? formatDate(next.ends_on) : null;
  const time   = next.starts_at ? formatTime(next.starts_at) : null;
  return [starts, ends ? `– ${ends}` : null, time ? `at ${time}` : null]
    .filter(Boolean).join(' ') || 'no date';
};

export default function PackEditor() {
  const { packId = '' } = useParams();
  const navigate = useNavigate();

  const [pack,     setPack]     = useState<Pack | null>(null);
  const [rows,     setRows]     = useState<Record<string, PackCategoryRow>>({});
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  // Always at least one — the database guarantees it, so the document never has
  // to draw a pack with no days.
  const [segments, setSegments] = useState<ScheduleSegment[]>([]);
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
  const [pendingNotify, setPendingNotify] = useState<PendingNotify | null>(null);
  // Separate from the modal's own state: the write runs while the modal is
  // still up, so the button can say it is working rather than the dialog
  // vanishing into a pause.
  const [notifying, setNotifying] = useState(false);
  /** A day-destroying change, held until confirmed. See ConfirmDays. */
  const [confirmDays, setConfirmDays] = useState<ConfirmDays | null>(null);
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, r, s, g, l, sg] = await Promise.all([
          getPack(packId), getCategoryRows(packId), getSchedule(packId),
          listGames(), listMyLocations(), getSegments(packId),
        ]);
        if (cancelled) return;
        if (!p) { setError('That pack does not exist, or you cannot open it.'); return; }
        setPack(p); setRows(r); setSchedule(s); setGames(g); setVenues(l); setSegments(sg);
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
    const [p, r, s, sg] = await Promise.all([
      getPack(packId), getCategoryRows(packId), getSchedule(packId), getSegments(packId),
    ]);
    if (p) setPack(p);
    setRows(r);
    setSchedule(s);
    setSegments(sg);
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

  const ctx: CategoryContext | null = pack ? { pack, rows, segments, schedule, games, venues } : null;
  const game  = games.find(g => g.id === pack?.game_id) ?? null;
  const venue = venues.find(v => v.id === pack?.location_id) ?? null;
  // The host may be a club this user administers but which is not in `venues`
  // (that list is venues you can run events AT), so it is looked up separately.
  const [host, setHost] = useState<LocationOption | null>(null);
  useEffect(() => {
    const id = pack?.host_location_id;
    if (!id) { setHost(null); return; }
    let cancelled = false;
    listMyClubs()
      .then(clubs => { if (!cancelled) setHost(clubs.find(c => c.id === id) ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pack?.host_location_id]);

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
   *
   * ON A PHONE, SELECTING IS ALSO NAVIGATING. The list closes and the form for
   * what was picked opens in its place — picking a category is a statement of
   * what you want to edit, and leaving the list up means a second tap on "Edit"
   * before anything can be typed. At lg+ both panels are always-visible columns
   * and these flags are ignored by the shell, so the swap is only ever made
   * when it means something.
   */
  const selectCategory = useCallback((key: string) => {
    const definition = CATEGORY_BY_KEY[key];
    if (!definition) return;

    setActiveKey(key);
    setActiveTab(definition.tab);
    if (panelsAreDrawers()) { setLeftOpen(false); setRightOpen(true); }

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

  /**
   * The same write, with a stop in front of it when it would email people.
   *
   * A published pack's date is not just data once somebody has saved the event:
   * changing it writes to every one of them (20260820010000). That consequence
   * is invisible from the form — an organiser nudging a start time by fifteen
   * minutes has no way of knowing they just wrote to forty people — so it is
   * made visible before the write rather than reported after it.
   *
   * The count is fetched HERE, at the moment of the change, rather than held in
   * state: the number in the sentence is the number of people about to be
   * emailed, and one read from ten minutes ago is not that.
   *
   * Nothing is written until confirm, which is what makes cancelling free: the
   * date fields render straight from `pack`, so an unconfirmed pick snaps back
   * on the next render with nothing to undo.
   */
  const savePackFieldsChecked = useCallback(async (patch: Record<string, unknown>) => {
    // Dates moved to segments, so nothing reaching this path can notify — but
    // the guard stays, because a pack column that notifies could be added back
    // and a warning that quietly stopped applying is the worst outcome.
    const movesTheEvent = NOTIFYING_FIELDS.some(f => f in patch);
    if (!movesTheEvent || pack?.status !== 'published') return savePackFields(patch);

    const count = await calendarAudienceSize(packId);
    if (count === 0) return savePackFields(patch);

    setPendingNotify({
      kind: 'moved',
      count,
      becomes: pack ? whenAfter(pack, patch) : undefined,
      run: () => savePackFields(patch),
    });
  }, [pack, packId, savePackFields]);

  /**
   * The write path for a day's dates and times.
   *
   * Separate from savePackFields because it writes a different table and is the
   * one that can email people: `battlepack_schedule_segments` is what the
   * notification signature is computed from, so a date change here is what
   * reaches everyone holding a calendar entry.
   *
   * NOT optimistic, unlike the pack write. The pack's own date columns are a
   * cache the database recomputes from this, so guessing the result locally
   * would mean guessing what a trigger is about to do — a reload is one round
   * trip and is certain.
   */
  const saveSegmentChecked = useCallback(async (patch: Partial<ScheduleSegment>) => {
    const day = segments[0];
    if (!day) return;

    const run = async () => {
      setSaveError(null);
      try {
        await updateSegment(day.id, patch);
        await reload();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Could not save that change.');
      }
    };

    const movesTheEvent = NOTIFYING_FIELDS.some(f => f in patch);
    if (!movesTheEvent || pack?.status !== 'published') return run();

    const count = await calendarAudienceSize(packId);
    // Nobody saved it, so nobody is told, so there is nothing to warn about.
    // Also the answer when the count itself failed — see calendarAudienceSize.
    if (count === 0) return run();

    setPendingNotify({ kind: 'moved', count, becomes: whenAfterDay(day, patch), run });
  }, [segments, pack?.status, packId, reload]);

  /**
   * Change what kind of event this is.
   *
   * Several writes, so it lives here rather than in the form: the shape column,
   * and then whatever has to happen to the days for the answer to be true. A
   * multi-day event with one day is not multi-day, and a league with clock
   * times is not a league.
   *
   * The only lossy direction is multi-day → one-day, which throws away days and
   * every round inside them. That one asks first; the rest are reversible by
   * choosing again.
   */
  const changeEventType = useCallback(async (next: PackTimeline) => {
    if (!pack) return;
    const days = [...segments].sort((a, b) => a.ordinal - b.ordinal);

    const apply = async () => {
      setSaveError(null);
      try {
        if (next === 'league') {
          // A league has no clock: players arrange their own games, so a start
          // time would be a promise nobody made.
          await Promise.all(days.map(d => updateSegment(d.id, { starts_at: null, ends_at: null })));
          await updatePack(pack.id, { schedule_shape: 'periods', timeline: 'league' } as Partial<Pack>);
        } else if (next === 'multi-day') {
          await updatePack(pack.id, { schedule_shape: 'days', timeline: 'multi-day' } as Partial<Pack>);
          // The count is the fact, so becoming multi-day means having a second
          // day rather than being labelled as though you do.
          if (days.length < 2) await addSegment(pack.id, days[days.length - 1] ?? null);
        } else {
          await Promise.all(days.slice(1).map(d => deleteSegment(d.id)));
          await updatePack(pack.id, { schedule_shape: 'days', timeline: 'one-day' } as Partial<Pack>);
        }
        await reload();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Could not change the event type.');
        await reload();
      }
    };

    const losing = next === 'one-day' ? days.length - 1 : 0;
    if (losing > 0) {
      setConfirmDays({
        title: `Drop ${losing === 1 ? 'the second day' : `${losing} days`}?`,
        body: `Becoming a one-day event removes ${losing === 1 ? 'it' : 'them'} and everything scheduled inside. That cannot be undone.`,
        confirmLabel: 'Make it one day',
        run: apply,
      });
      return;
    }

    await apply();
  }, [pack, segments, reload]);

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
  const keyInfoRows = () => keyInfoRowsShared(pack, venue);

  /** What one category contributes to the document — shared with the public
   *  page at /:slug, so the organiser and the attendee see one document. */
  const bodyFor = (c: typeof categories[number]) =>
    categoryBody({ category: c, pack, rows, segments, schedule });

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
            /* Tapping the pack is the other way into a category, and the one
               that needs no aim: you point at the thing you can see is wrong.
               It runs through selectCategory like the nav does, so on a phone
               it brings the form up with it. */
            onSelect={() => selectCategory(c.key)}
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
              {/* Key Info has no form of its own — every fact in it is typed
                  into Event Basics, which is where its own empty hint sends
                  you. So tapping it opens that, rather than being the one
                  section on the page that does nothing when tapped. */}
              <DocumentSection
                categoryKey="key-info"
                title="Key Info"
                onSelect={() => selectCategory('event-basics')}
              >
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
            /* Same swap as a category — Publish is a row in this list, and a
               row that closed the list without showing you anything would be
               the odd one out. Not selectCategory, because it has no registry
               entry, no tab and no section to scroll to. */
            onSelect={() => {
              setActiveKey(PUBLISH_KEY);
              if (panelsAreDrawers()) { setLeftOpen(false); setRightOpen(true); }
            }}
          />
        </ListPanel>
      }

      center={
        <main className="flex-1 min-w-0 overflow-y-auto lg:order-2 p-2 lg:p-4">
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
              /* The host the organiser chose, not an inference from the venue.
                 A club can run an event at a shop, which the venue field alone
                 could never say. */
              clubName={host?.name ?? null}
              clubIcon={host?.icon ?? null}
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
                  /* "Registration & Schedule" gets about half a phone's width
                     in a segmented bar and truncates to nothing. */
                  mobileDropdown
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
              /* The narrow one. A first publish tells nobody — nobody can have
                 saved a pack that has never been public. A RE-publish can, if
                 the date moved while it was down, so the count asked for here
                 is "who is stale" rather than "who saved it": warning about
                 forty emails before something that sends none is how a warning
                 stops being read. */
              onPublish={async slug => {
                const publish = async () => { await publishPack(pack, slug); await reload(); };
                const count = await pendingNotifyCount(pack.id);
                if (count === 0) return publish();
                setPendingNotify({ kind: 'moved', count, run: publish });
              }}
              /* Same stop as a date change, and a heavier one: taking the event
                 down writes to EVERYONE who saved it, not just the people whose
                 date has drifted. */
              onUnpublish={async () => {
                const withdraw = async () => { await unpublishPack(pack.id); await reload(); };
                const count = await calendarAudienceSize(pack.id);
                if (count === 0) return withdraw();
                setPendingNotify({ kind: 'withdrawn', count, run: withdraw });
              }}
            />
          ) : activeDefinition && ctx ? (
            <activeDefinition.Form
              {...ctx}
              categoryKey={activeDefinition.key}
              onChange={savePackFieldsChecked}
              onSegmentChange={saveSegmentChecked}
              onTypeChange={changeEventType}
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

        {/* The one modal that is not about this pack's contents but about the
            people reading it. Deliberately states the NUMBER: "attendees will
            be notified" is a warning an organiser learns to click through,
            and "12 people" is one they read. */}
        <Modal
          open={pendingNotify !== null}
          onClose={() => (notifying ? undefined : setPendingNotify(null))}
          className="max-w-sm"
        >
          <div className="flex flex-col gap-4 p-5">
            <h2 className="font-heading text-xl text-white">
              {pendingNotify?.kind === 'withdrawn'
                ? `Tell ${people(pendingNotify.count)} it is off?`
                : `Tell ${people(pendingNotify?.count ?? 0)} the date has changed?`}
            </h2>

            <p className="font-body text-sm text-gray-300">
              {pendingNotify?.kind === 'withdrawn'
                ? `${people(pendingNotify.count)} added this event to their own calendar.
                   Taking it down emails them to say it is not going ahead.`
                : `${people(pendingNotify?.count ?? 0)} added this event to their own calendar,
                   and the date in there is the one you are about to change. Saving
                   emails them the new date and a link to re-add it.`}
            </p>

            {/* What they are actually confirming. The date field is controlled
                by `pack`, which is not written until they say yes, so the input
                behind this dialog has already snapped back to the old value —
                without this line the question is about a date no longer on
                screen. */}
            {pendingNotify?.becomes && (
              <div className="rounded-lg bg-gray-900 px-4 py-3">
                <p className="font-body text-xs uppercase tracking-wide text-gray-500 font-bold">
                  New date
                </p>
                <p className="font-body font-medium text-base leading-6 text-gray-50">
                  {pendingNotify.becomes}
                </p>
              </div>
            )}

            {/* Said plainly because organisers assume otherwise: we can write to
                somebody, we cannot reach into their diary. */}
            <p className="font-body text-sm text-gray-400">
              Their calendar entry does not change by itself — the email is all we
              can do.
            </p>

            <ButtonPair>
              <Button
                color={pendingNotify?.kind === 'withdrawn' ? 'danger' : 'primary'}
                disabled={notifying}
                onClick={async () => {
                  const job = pendingNotify;
                  if (!job) return;
                  setNotifying(true);
                  try { await job.run(); } finally { setNotifying(false); setPendingNotify(null); }
                }}
              >
                {notifying
                  ? 'Saving…'
                  : pendingNotify?.kind === 'withdrawn' ? 'Take it down and tell them' : 'Save and tell them'}
              </Button>
              <Button
                variant="outline"
                color="secondary"
                disabled={notifying}
                onClick={() => setPendingNotify(null)}
              >
                Cancel
              </Button>
            </ButtonPair>
          </div>
        </Modal>

        {/* Losing a day is not like hiding a category, which gives its content
            back. This takes the day and every round inside it, so it is always
            asked — whether it came from the day list or from becoming a one-day
            event. */}
        <Modal
          open={confirmDays !== null}
          onClose={() => setConfirmDays(null)}
          className="max-w-sm"
        >
          <div className="flex flex-col gap-4 p-5">
            <h2 className="font-heading text-xl text-white">{confirmDays?.title}</h2>
            <p className="font-body text-sm text-gray-300">{confirmDays?.body}</p>
            <ButtonPair>
              <Button
                color="danger"
                onClick={() => {
                  const job = confirmDays;
                  setConfirmDays(null);
                  if (job) void job.run();
                }}
              >
                {confirmDays?.confirmLabel ?? 'Remove'}
              </Button>
              <Button variant="outline" color="secondary" onClick={() => setConfirmDays(null)}>
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
