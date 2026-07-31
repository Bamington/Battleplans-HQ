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
 * V1 HAS NO PUBLIC READ VIEW, so publishing reserves a URL for a page that does
 * not resolve yet. The copy says exactly that. Claiming "your event is live"
 * when nothing renders would be a lie the organiser could check in one click.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Badge, Button, Callout, CheckCircle, DangerCircle, HR, Input, Rocket,
} from '@battleplans/ui';
import { isSlugAvailable, suggestSlugs } from '../lib/packs';
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

/** Where a published pack will live, once the public view exists. */
const SITE = 'battlepack.app';

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

  // Once the pack has a slug it is the only possible value, so stop tracking.
  useEffect(() => { if (pack.slug) setSlug(pack.slug); }, [pack.slug]);

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
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-body text-base font-bold text-white">Status</h3>
          <Badge color={pack.status === 'published' ? 'success' : pack.status === 'unpublished' ? 'warning' : 'gray'}>
            {pack.status === 'published' ? 'Published' : pack.status === 'unpublished' ? 'Withdrawn' : 'Draft'}
          </Badge>
        </div>
        <HR />
      </div>

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
      <div className="flex flex-col gap-1">
        <h3 className="font-body text-base font-bold text-white">Public URL</h3>
        <HR />
      </div>

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

        <p className="font-body text-sm text-gray-400 break-all">
          {SITE}/<span className="text-white">{slug || '…'}</span>
        </p>

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
            onClick={() => run(() => onPublish(slug))}
          >
            {busy ? 'Publishing…' : pack.status === 'unpublished' ? 'Publish again' : 'Publish'}
          </Button>
          <p className="font-body text-xs text-gray-500">
            Publishing reserves this URL. The public page is not built yet, so nothing
            resolves there in the meantime — nobody outside BattlePack can see the pack.
          </p>
        </div>
      )}
    </div>
  );
};

export default PublishPanel;
