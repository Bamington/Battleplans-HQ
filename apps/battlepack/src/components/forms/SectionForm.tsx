/**
 * SectionForm.tsx — the right panel for every `section`-storage category.
 *
 * The third and last write path: prose kept as markdown in
 * `battlepack_categories.content`, as `{ body }`.
 *
 * ONE COMPONENT, SEVERAL CATEGORIES. FAQ, Key Info, Tickets, Prizes and the
 * rest all want the same thing — a block of formatted text — so they share this
 * form and differ only in the copy the registry hands it. That is not a
 * contradiction of "every category gets a bespoke form": the registry still maps
 * each key to a component, and any category that outgrows this swaps its own in
 * without touching the others.
 *
 * Markdown rather than a jsonb structure because the design's sections are
 * prose with the occasional bulleted list, and the shared <RichTextEditor>
 * already reads and writes markdown that <MarkdownBody> renders. A structured
 * shape would buy nothing until something actually queries inside a section.
 *
 * SAVING is debounced rather than on blur. A rich text editor loses focus for
 * ordinary reasons — clicking a toolbar button, tabbing away mid-thought — so
 * blur is both too eager and, when the organiser switches category without
 * clicking out, too late. The pending write is flushed on unmount so switching
 * away never drops what was typed.
 */

import { useEffect, useRef, useState } from 'react';
import { HR, Input, RichTextEditor } from '@battleplans/ui';
import type { CategoryFormProps } from '../../registry/categories';
import { CATEGORY_BY_KEY } from '../../registry/categories';
import { saveCategoryContent } from '../../lib/packs';

/** How long to wait after the last keystroke before writing. */
const SAVE_DELAY_MS = 1000;

/** The single write, injectable so the gallery can drive it from memory —
 *  same reasoning as RoundsBreaksForm's `ops`. The debounce and the
 *  flush-on-unmount are the parts most worth being able to exercise. */
export type SaveSection = (packId: string, key: string, content: unknown) => Promise<void>;

const SectionForm = ({
  pack, rows, categoryKey, reload, save: saveFn = saveCategoryContent,
}: CategoryFormProps & { save?: SaveSection }) => {
  const definition = CATEGORY_BY_KEY[categoryKey];
  const content = rows[categoryKey]?.content as { body?: string; url?: string } | null | undefined;
  const stored    = content?.body ?? '';
  const storedUrl = content?.url ?? '';

  const [body, setBody]   = useState(stored);
  const [url,  setUrl]    = useState(storedUrl);
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');

  // Refs so the unmount flush sees the latest value without re-subscribing.
  const latest    = useRef(body);
  const latestUrl = useRef(url);
  const dirty     = useRef(false);

  // Re-sync when the editor switches to a different category, or the row is
  // refetched. Guarded on `dirty` so a reload mid-edit cannot clobber typing.
  useEffect(() => {
    if (dirty.current) return;
    setBody(stored);
    setUrl(storedUrl);
    latest.current    = stored;
    latestUrl.current = storedUrl;
  }, [stored, storedUrl, categoryKey]);

  const toContent = (b: string, u: string) =>
    (b.trim() || u.trim()) ? { body: b, url: u.trim() || undefined } : null;

  async function save(next: string, nextUrl: string) {
    setState('saving');
    try {
      await saveFn(pack.id, categoryKey, toContent(next, nextUrl));
      dirty.current = false;
      setState('idle');
      await reload();
    } catch {
      setState('error');
    }
  }

  const onChange = (next: string) => {
    dirty.current = true;
    latest.current = next;
    setBody(next);
  };

  const onUrlChange = (next: string) => {
    dirty.current = true;
    latestUrl.current = next;
    setUrl(next);
  };

  // Debounced write.
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => { void save(latest.current, latestUrl.current); }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, url]);

  // Flush on the way out — switching category unmounts this before the debounce
  // would have fired, and losing a sentence to that would be indefensible.
  useEffect(() => () => {
    if (dirty.current) void saveFn(
      pack.id, categoryKey, toContent(latest.current, latestUrl.current),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-body text-sm font-bold text-white">{definition?.label ?? 'Section'}</h3>
          <span className="font-body text-xs text-gray-500">
            {state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved' : ''}
          </span>
        </div>
        <HR />
      </div>

      {definition?.formHint && (
        <p className="font-body text-xs text-gray-400">{definition.formHint}</p>
      )}

      <RichTextEditor
        value={body}
        onChange={onChange}
        placeholder={definition?.placeholder ?? 'Write this section…'}
      />

      {/* Tickets and Registration both send people somewhere else, so the link
          is its own field rather than something to remember to paste into the
          prose — the document can then render it as a proper link. */}
      {definition?.hasUrl && (
        <Input
          label="Link"
          type="url"
          inputMode="url"
          placeholder="https://…"
          helperText="Optional. Shown under this section as a link."
          value={url}
          onChange={e => onUrlChange(e.target.value)}
        />
      )}
    </div>
  );
};

export default SectionForm;
