/**
 * SectionForm.tsx — the right panel for every `section`-storage category.
 *
 * The third and last write path: prose kept as markdown in
 * `battlepack_categories.content`, as `{ body, url }`.
 *
 * ONE COMPONENT, SEVERAL CATEGORIES. Key Info, What you'll need to play,
 * Tickets, Registration, Prizes and FAQ all want the same thing — a block of
 * formatted text — so they share this form and differ only in the copy the
 * registry hands it. That is not a contradiction of "every category gets a
 * bespoke form": the registry still maps each key to a component, and any
 * category that outgrows this swaps its own in without touching the others.
 *
 * Markdown rather than a jsonb structure because the design's sections are
 * prose with the occasional bulleted list, and the shared <RichTextEditor>
 * already reads and writes markdown that <MarkdownBody> renders. A structured
 * shape would buy nothing until something actually queries inside a section.
 *
 * Saving is debounced with a flush on unmount — see useDebouncedSave for why
 * blur is the wrong commit point for a rich text editor.
 */

import { PanelSection, Input, RichTextEditor } from '@battleplans/ui';
import type { CategoryFormProps } from '../../registry/categories';
import { CATEGORY_BY_KEY } from '../../registry/categories';
import { saveCategoryContent } from '../../lib/packs';
import { useDebouncedSave } from '../../hooks/useDebouncedSave';

/** The single write, injectable so the gallery can drive it from memory. The
 *  debounce and the flush-on-unmount are the parts most worth exercising. */
export type SaveSection = (packId: string, key: string, content: unknown) => Promise<void>;

interface SectionValue {
  body: string;
  url: string;
}

const SectionForm = ({
  pack, rows, categoryKey, reload, save: saveFn = saveCategoryContent,
}: CategoryFormProps & { save?: SaveSection }) => {
  const definition = CATEGORY_BY_KEY[categoryKey];
  const content = rows[categoryKey]?.content as { body?: string; url?: string } | null | undefined;

  const stored: SectionValue = { body: content?.body ?? '', url: content?.url ?? '' };

  const { value, setValue, state } = useDebouncedSave<SectionValue>(stored, async next => {
    // A section is empty only when BOTH fields are — otherwise a link with no
    // blurb yet would be thrown away the moment it was typed.
    const payload = next.body.trim() || next.url.trim()
      ? { body: next.body, url: next.url.trim() || undefined }
      : null;
    await saveFn(pack.id, categoryKey, payload);
    await reload();
  });

  return (
    <PanelSection
      title={definition?.label ?? 'Section'}
      action={state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved' : ''}
    >

      {definition?.formHint && (
        <p className="font-body text-xs text-gray-400">{definition.formHint}</p>
      )}

      <RichTextEditor
        value={value.body}
        onChange={body => setValue({ ...value, body })}
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
          value={value.url}
          onChange={e => setValue({ ...value, url: e.target.value })}
        />
      )}
    </PanelSection>
  );
};

export default SectionForm;
