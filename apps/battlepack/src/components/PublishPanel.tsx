/**
 * PublishPanel.tsx — the right panel for the Publish step.
 *
 * Publish is a state flag, not the end of a wizard. A published pack stays
 * fully editable: real events change constantly, and if publishing froze the
 * content then fixing a typo would mean unpublishing — which tombstones the URL
 * for every attendee holding the link — and then republishing. So this panel is
 * somewhere you return to, not somewhere you pass through once.
 *
 * THE SLUG IS THE ONE THING THAT LOCKS. It is offered as a suggestion the
 * organiser can edit, with a live preview of the URL, because it cannot be
 * changed afterwards and they should see what they are committing to. The
 * availability check here is advisory only — two organisers publishing the same
 * slug at the same moment would both be told it is free. The primary key on
 * battlepack_slugs is what actually decides, and the loser gets an error.
 *
 * PUBLISHING ALSO HOLDS THE VENUE'S TABLES, when the organiser asks it to and
 * the venue is run on BattlePlan. That pairing is deliberate: an event is not
 * really on until it is published, and closing a shop's tables for something
 * nobody can see would be the wrong way round. Unpublishing releases them
 * again — enforced by a trigger, not by this panel, so a closed tab cannot
 * leave a venue blocked. See lib/tableBlocks.ts and 20260803000000.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Badge, Button, Callout, CheckCircle, Checkbox, DangerCircle, ExternalLink, PanelSection,
  Input, Select, Rocket,
} from '@battleplans/ui';
import {
  NO_BLOCK, listStoreTables, locationUsesBattlePlan, packBlockWhen,
  readSelection, syncPackBlocks,
} from '../lib/tableBlocks';
import type { BlockSelection, BlockTableScope, StoreTableOption } from '../lib/tableBlocks';
import { isSlugAvailable, suggestSlugs } from '../lib/packs';
import { recurrencePattern } from '../lib/recurrence';
import type { Pack } from '../lib/packs';
import type { CategoryDefinition } from '../registry/categories';

export interface PublishPanelProps {
  pack: Pack;
  /** The venue's name, so a suggestion can strip it from the slug. */
  venueName?: string | null;
  /** Categories still missing a required field. Empty means publishable. */
  outstanding: CategoryDefinition[];
  /** Jump to a category from the outstanding list. */
  onSelectCategory: (key: string) => void;
  onPublish: (slug: string) => Promise<void>;
  onUnpublish: () => Promise<void>;
  /** Availability check, injectable so the gallery can drive it from memory. */
  checkSlug?: (candidate: string) => Promise<boolean>;
}

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'invalid' | 'error';

/** "12/09/2026" — the same dd/mm/yyyy the rest of the platform uses. */
function formatBlockDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/**
 * Where a published pack lives once it is published.
 *
 * Hard-coded, and NOT window.location.origin. This is the address an organiser
 * copies into a Facebook post — it has to be the canonical one even when the
 * editor is being used on a preview deployment, whose hostname stops resolving
 * the moment that deployment ages out.
 */
const SITE = 'battlepack.app';
const publicUrl = (slug: string) => `https://${SITE}/${slug}`;

/** How long the URL says "Copied" before going back to saying the URL. */
const COPIED_MS = 1600;

const PublishPanel = ({
  pack, venueName, outstanding, onSelectCategory, onPublish, onUnpublish,
  checkSlug = isSlugAvailable,
}: PublishPanelProps) => {
  const locked = pack.slug != null;

  const suggestions = useMemo(
    () => (locked ? [] : suggestSlugs(pack.name, venueName)),
    [locked, pack.name, venueName],
  );

  const [slug, setSlug]         = useState(pack.slug ?? suggestions[0] ?? '');
  const [avail, setAvail]       = useState<Availability>('idle');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');

  // ── Table holding ──────────────────────────────────────────────────────────
  const [usesBattlePlan, setUsesBattlePlan] = useState(false);
  const [tables, setTables]         = useState<StoreTableOption[]>([]);
  const [selection, setSelection]   = useState<BlockSelection>(NO_BLOCK);
  const [blockState, setBlockState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [blockBusy, setBlockBusy]   = useState(false);

  /**
   * WHEN the hold lands, said the way the pack actually runs.
   *
   * One date for a one-day event, a range for a tournament across a weekend,
   * and the repeat pattern for a series — because a checkbox promising to hold
   * tables "on 11/07/2026" for something that runs every Friday until December
   * would be describing a fraction of what it does.
   *
   * Null means nothing can be held: no start date, or a league, which holds
   * nothing by design.
   */
  const blockWhen = (() => {
    const rules = packBlockWhen(pack);
    if (rules.length === 0) return null;
    const repeat = recurrencePattern(pack);
    if (repeat) {
      return pack.until_date
        ? `${repeat.toLowerCase()} until ${formatBlockDate(pack.until_date)}`
        : repeat.toLowerCase();
    }
    const days = rules.map(r => r.date);
    return days.length > 1
      ? `on ${formatBlockDate(days[0])} – ${formatBlockDate(days[days.length - 1])}`
      : `on ${formatBlockDate(days[0])}`;
  })();

  useEffect(() => {
    let stale = false;
    (async () => {
      const managed = await locationUsesBattlePlan(pack.location_id);
      if (stale) return;
      setUsesBattlePlan(managed);
      if (!managed) return;
      const [list, current] = await Promise.all([
        listStoreTables(pack.location_id),
        readSelection(pack.id),
      ]);
      if (stale) return;
      setTables(list);
      setSelection(current);
    })();
    return () => { stale = true; };
  }, [pack.location_id, pack.id]);

  /**
   * Take a change to the selection.
   *
   * Staged while the pack is a draft — there is nothing to hold tables for
   * until it publishes, and writing early would close a venue for an event
   * nobody can see. Once published it writes immediately, like every other
   * field in this editor.
   */
  async function applySelection(next: BlockSelection) {
    setSelection(next);
    if (pack.status !== 'published') return;

    setBlockBusy(true);
    setBlockState('saving');
    try {
      await syncPackBlocks(pack, next);
      setBlockState('idle');
    } catch {
      setBlockState('error');
    } finally {
      setBlockBusy(false);
    }
  }

  // Once the pack has a slug it is the only possible value, so stop tracking.
  useEffect(() => { if (pack.slug) setSlug(pack.slug); }, [pack.slug]);

  // The "Copied" label reverts on its own. Cleared on unmount so a panel that
  // is swapped out mid-flash does not set state on a gone component.
  useEffect(() => {
    if (copyState === 'idle') return;
    const t = setTimeout(() => setCopyState('idle'), COPIED_MS);
    return () => clearTimeout(t);
  }, [copyState]);

  /**
   * Put the public URL on the clipboard.
   *
   * Says so when it fails rather than doing nothing visible: the clipboard API
   * needs a secure context and a permission that a browser can refuse, and a
   * button that silently does nothing is the worst of the three outcomes.
   */
  const copyUrl = async () => {
    if (!pack.slug) return;
    try {
      await navigator.clipboard.writeText(publicUrl(pack.slug));
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
  };

  // Debounced availability. Advisory — see the note at the top of this file.
  //
  // Shape is checked here rather than left to the round trip, because the RPC
  // answers a single boolean: a malformed slug, a reserved app route and a slug
  // somebody else already holds all come back the same `false`. Catching the
  // malformed case locally is the only way to say WHY it was refused — and the
  // same regex the database trigger uses, so the two cannot disagree.
  useEffect(() => {
    if (locked) { setAvail('idle'); return; }

    const candidate = slug.trim();
    if (!candidate) { setAvail('idle'); return; }

    if (!/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/.test(candidate)) {
      setAvail('invalid');
      return;
    }

    setAvail('checking');

    // `stale` guards the response, not just the timer. Clearing the timeout only
    // stops a request that has not been sent — a request already in flight still
    // resolves, and without this its answer lands on whatever the organiser has
    // typed since. That is how a malformed slug ended up reported as taken.
    let stale = false;
    const timer = setTimeout(() => {
      checkSlug(candidate)
        .then(free => { if (!stale) setAvail(free ? 'free' : 'taken'); })
        .catch(()   => { if (!stale) setAvail('error'); });
    }, 400);

    return () => { stale = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, locked]);

  const complete    = outstanding.length === 0;
  const slugUsable  = locked || avail === 'free';
  const canPublish  = complete && slugUsable && !busy;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : 'That did not work.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Where it stands ── */}
      <PanelSection
        title="Status"
        action={
          <Badge color={pack.status === 'published' ? 'success' : pack.status === 'unpublished' ? 'warning' : 'gray'}>
            {pack.status === 'published' ? 'Published' : pack.status === 'unpublished' ? 'Withdrawn' : 'Draft'}
          </Badge>
        }
      />

      {error && <Callout flavour="bad" onDismiss={() => setError(null)}>{error}</Callout>}

      {/* ── Completeness ── */}
      <div className="flex flex-col gap-2">
        {complete ? (
          <p className="flex items-center gap-2 font-body text-sm text-primary-400">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Every category is complete.
          </p>
        ) : (
          <>
            <p className="flex items-start gap-2 font-body text-sm text-gray-300">
              <DangerCircle className="w-4 h-4 shrink-0 mt-0.5 text-gray-500" />
              <span>
                {outstanding.length} categor{outstanding.length === 1 ? 'y' : 'ies'} still
                need{outstanding.length === 1 ? 's' : ''} filling in before you can publish.
              </span>
            </p>
            <div className="flex flex-col gap-1">
              {outstanding.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onSelectCategory(c.key)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded border border-gray-700
                             hover:border-gray-500 text-left cursor-pointer transition-colors"
                >
                  <span className="shrink-0 text-gray-500">{c.icon}</span>
                  <span className="flex-1 min-w-0 font-body text-sm text-gray-300 truncate">{c.label}</span>
                </button>
              ))}
            </div>
            {/* Hiding is a legitimate way out, and not an obvious one. */}
            <p className="font-body text-xs text-gray-500">
              Adding an optional category is opting in to finishing it. If you do not
              want one, remove it from the list on the left instead.
            </p>
          </>
        )}
      </div>

      {/* ── The URL ── */}
      <PanelSection title="Public URL" />

      <div className="flex flex-col gap-2">
        <Input
          label="URL"
          value={slug}
          onChange={e => setSlug(e.target.value)}
          disabled={locked}
          placeholder="season-6-league"
          state={['taken', 'invalid', 'error'].includes(avail) ? 'error' : 'default'}
          helperText={
            locked
              ? 'Locked. A published URL never moves, and is never reused by another pack.'
              : avail === 'checking' ? 'Checking…'
              // Deliberately not "already taken": the check cannot tell a slug
              // somebody holds from one the app reserves for its own routes, and
              // guessing would tell the organiser something untrue.
              : avail === 'taken'    ? 'That URL is not available — try another.'
              : avail === 'invalid'  ? 'Letters, numbers and hyphens only, starting and ending with a letter or number.'
              : avail === 'error'    ? 'Could not check that URL. Try again in a moment.'
              : avail === 'free'     ? 'Available.'
              : 'Set this before publishing — it cannot be changed afterwards.'
          }
        />

        {/* Before publishing this is a PREVIEW of an address that does not
            resolve yet, so it stays plain text — offering to copy or open a
            URL that 404s would be offering a broken link. Once the pack is
            live the same line becomes the two things an organiser actually
            wants: copy it to paste somewhere, or go and look at it. */}
        {pack.status === 'published' && pack.slug ? (
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={copyUrl}
              title="Copy this URL"
              className="flex-1 min-w-0 text-left font-body text-sm text-gray-400 break-all
                         hover:text-gray-300 cursor-pointer transition-colors"
            >
              {SITE}/<span className="text-white">{pack.slug}</span>
              {/* The feedback replaces nothing and moves nothing — it is
                  appended, so the line does not reflow under the cursor at the
                  moment of the click. */}
              {copyState === 'done'  && <span className="text-primary-500"> — Copied</span>}
              {copyState === 'error' && <span className="text-amber-400"> — Could not copy; select it instead</span>}
            </button>

            <a
              href={publicUrl(pack.slug)}
              target="_blank"
              rel="noopener noreferrer"
              title="Open the public page in a new tab"
              aria-label="Open the public page in a new tab"
              className="shrink-0 mt-0.5 text-gray-400 hover:text-primary-500 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <p className="font-body text-sm text-gray-400 break-all">
            {SITE}/<span className="text-white">{slug || '…'}</span>
          </p>
        )}

        {suggestions.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-body text-xs text-gray-500">Try:</span>
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSlug(s)}
                className="px-2 py-0.5 rounded border border-gray-700 hover:border-gray-500
                           font-body text-xs text-gray-300 cursor-pointer transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Holding the venue's tables ──
          Only for venues actually run on BattlePlan. Offering to close tables
          at a shop with none is offering nothing, so the whole section is
          absent rather than disabled. */}
      {usesBattlePlan && (
        <>
          <PanelSection
            title="Tables"
            action={blockState === 'saving' ? 'Saving…' : blockState === 'error' ? 'Not saved' : ''}
          />

          <div className="flex flex-col gap-2">
            {blockWhen ? (
              <>
                <Checkbox
                  label={`Hold tables at ${venueName ?? 'this venue'} ${blockWhen}`}
                  checked={selection.enabled}
                  onChange={e => applySelection({ ...selection, enabled: e.target.checked })}
                  disabled={blockBusy}
                />

                {selection.enabled && (
                  <div className="flex flex-col gap-2 ps-6">
                    <Select
                      value={selection.scope}
                      onChange={e => applySelection({
                        ...selection,
                        scope: e.target.value as BlockTableScope,
                      })}
                      disabled={blockBusy}
                      options={[
                        { value: 'all',      label: 'Every table' },
                        { value: 'selected', label: 'Only some tables' },
                      ]}
                    />

                    {selection.scope === 'selected' && (
                      <div className="flex flex-col gap-1.5">
                        {tables.map(t => (
                          <Checkbox
                            key={t.id}
                            label={t.name}
                            checked={selection.tableIds.includes(t.id)}
                            disabled={blockBusy}
                            onChange={e => applySelection({
                              ...selection,
                              tableIds: e.target.checked
                                ? [...selection.tableIds, t.id]
                                : selection.tableIds.filter(id => id !== t.id),
                            })}
                          />
                        ))}
                        {selection.tableIds.length === 0 && (
                          <p className="font-body text-xs text-gray-500">
                            Nothing ticked holds nothing. Choose at least one table.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <p className="font-body text-xs text-gray-500">
                  {pack.status === 'published'
                    ? 'Changes apply straight away. Unpublishing or deleting the event releases the tables.'
                    : 'Applied when you publish. Unpublishing or deleting the event releases the tables again.'}
                </p>
              </>
            ) : (
              <p className="font-body text-sm text-gray-500">
                {pack.schedule_shape === 'periods'
                  ? `A league's games are arranged by the players over weeks, so there is
                     no single day to hold — the venue stays bookable throughout.`
                  : `Set a start date in Event Basics and you can hold the venue's tables
                     for it.`}
              </p>
            )}
          </div>
        </>
      )}

      {/* ── Actions ── */}
      {pack.status === 'published' ? (
        <div className="flex flex-col gap-2">
          <Button variant="outline" color="danger" className="w-full" disabled={busy} onClick={() => run(onUnpublish)}>
            {busy ? 'Working…' : 'Unpublish'}
          </Button>
          <p className="font-body text-xs text-gray-500">
            Withdrawing keeps the URL, which then says the event is not currently
            available rather than that it never existed. You can publish again at any
            time. Editing does not need this — a published pack stays editable.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            leftIcon={<Rocket className="w-4 h-4" />}
            disabled={!canPublish}
            onClick={() => run(async () => {
              await onPublish(slug);
              // Only once the pack is actually published. A block written
              // against a pack that failed to publish would hold a venue for
              // an event with no public page.
              await syncPackBlocks(pack, selection).catch(() => {});
            })}
          >
            {busy ? 'Publishing…' : pack.status === 'unpublished' ? 'Publish again' : 'Publish'}
          </Button>
          <p className="font-body text-xs text-gray-500">
            Publishing puts the pack at its URL for anyone to read.
          </p>
        </div>
      )}
    </div>
  );
};

export default PublishPanel;
