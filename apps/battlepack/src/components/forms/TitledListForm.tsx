/**
 * TitledListForm.tsx — the right panel for categories that are a list of
 * titled entries.
 *
 * Prizes and Resources are the same shape: a named thing with a few words about
 * it, repeated. Resources adds a link. That difference is one registry flag —
 * `hasUrl` — rather than a second component, exactly as SectionForm serves
 * every prose category from one file.
 *
 * WHY A LIST AND NOT PROSE. Prizes was a single markdown field, which meant
 * "Best General, Best Painted, and a wooden spoon" was one paragraph the
 * document could not lay out, count, or ever do anything with. Three prizes are
 * three things; storing them as three things is what lets the document render
 * them as three.
 *
 * The title is plain text — it is a label, and bold-italic inside one is noise.
 * The description is markdown, because it routinely wants a list or a link and
 * the platform's other prose fields all are.
 *
 * Stored as `{ items: [{ title, description, url? }] }` on the category's jsonb.
 */

import {
  Button, PanelSection, EditableListItem, Input, RichTextEditor,
  AddCircle,
} from '@battleplans/ui';
import type { CategoryFormProps } from '../../registry/categories';
import { CATEGORY_BY_KEY } from '../../registry/categories';
import { saveCategoryContent } from '../../lib/packs';
import { useDebouncedSave } from '../../hooks/useDebouncedSave';
import type { SaveSection } from './SectionForm';

export interface TitledListItem {
  title: string;
  description: string;
  /** Only collected when the category's registry entry sets `hasUrl`. */
  url?: string;
}

/** Read whatever is stored, tolerating the empty and legacy-prose cases. */
export function readTitledList(content: unknown): TitledListItem[] {
  const value = content as { items?: TitledListItem[]; body?: string } | null | undefined;
  if (Array.isArray(value?.items)) return value.items;
  // Prizes was one markdown field before this form existed. Keep the words as a
  // single untitled entry the organiser can split up, rather than dropping work
  // on the floor because the shape changed underneath them.
  if (value?.body?.trim()) return [{ title: '', description: value.body.trim() }];
  return [];
}

/**
 * True when an entry is worth publishing.
 *
 * A title OR a description, not a title specifically. Prizes was a single
 * markdown field before this form existed, and real packs have prose in it —
 * that reads back as one untitled entry, and demanding a title would flip a
 * category those packs had already completed back to incomplete and block
 * publishing on content nobody had touched.
 */
export const titledListFilled = (items: TitledListItem[]) =>
  items.some(i => i.title.trim() || i.description.trim());

const TitledListForm = ({
  pack, rows, categoryKey, reload, save: saveFn = saveCategoryContent,
}: CategoryFormProps & { save?: SaveSection }) => {
  const definition = CATEGORY_BY_KEY[categoryKey];
  const stored = readTitledList(rows[categoryKey]?.content);

  const { value: items, setValue: setItems, state } = useDebouncedSave<TitledListItem[]>(
    stored,
    async next => {
      // An entry with nothing in any field is not a prize — drop it rather than
      // publishing a blank row.
      const kept = next.filter(i => i.title.trim() || i.description.trim() || i.url?.trim());
      await saveFn(pack.id, categoryKey, kept.length ? { items: kept } : null);
      await reload();
    },
  );

  const update = (index: number, patch: Partial<TitledListItem>) =>
    setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  const noun = definition?.itemNoun ?? 'item';

  return (
    <PanelSection
      title={definition?.label ?? 'List'}
      action={state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved' : ''}
    >

      {definition?.formHint && (
        <p className="font-body text-xs text-gray-400">{definition.formHint}</p>
      )}

      {items.length === 0 && (
        <p className="font-body text-sm text-gray-500">
          Nothing here yet. Add one {noun} at a time.
        </p>
      )}

      {items.map((item, index) => (
        <EditableListItem
          key={index}
          index={index}
          count={items.length}
          removeLabel={`Remove ${noun} ${index + 1}`}
          onMove={delta => move(index, delta)}
          onRemove={() => setItems(items.filter((_, i) => i !== index))}
          header={
            <Input
              size="sm"
              placeholder={definition?.placeholder ?? 'Best General'}
              value={item.title}
              onChange={e => update(index, { title: e.target.value })}
            />
          }
        >
          <RichTextEditor
            value={item.description}
            onChange={description => update(index, { description })}
            placeholder="A few words about it."
          />

          {definition?.hasUrl && (
            <Input
              size="sm"
              type="url"
              inputMode="url"
              placeholder="https://… (optional)"
              value={item.url ?? ''}
              onChange={e => update(index, { url: e.target.value })}
            />
          )}
        </EditableListItem>
      ))}

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        leftIcon={<AddCircle className="w-4 h-4" />}
        onClick={() => setItems([...items, { title: '', description: '' }])}
      >
        Add {noun.charAt(0).toUpperCase()}{noun.slice(1)}
      </Button>
    </PanelSection>
  );
};

export default TitledListForm;
