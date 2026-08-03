/**
 * ChecklistSectionForm.tsx — the right panel for "What you'll need to play".
 *
 * That section is always a bulleted list, so the editor is a list of rows
 * rather than a prose field. Letting someone type a paragraph into it and
 * hoping they used the bullet button produces a section that renders as one
 * blob half the time; a row per item cannot.
 *
 * Each item is PLAIN text plus an optional URL. Plain because a checklist item
 * is a phrase — "dice and a tape measure" — and bold-italic inside a bullet is
 * noise. The URL is a separate field rather than something pasted into the
 * text, so the document can make the whole line clickable instead of leaving a
 * bare address in the middle of a sentence.
 *
 * Stored as `{ items: [{ text, url? }] }` on the category's jsonb. Still
 * `section` storage — the shape inside it is this category's business, which is
 * the point of the registry mapping each key to its own form.
 */

import {
  Button, PanelSection, Input, EditableListItem,
  AddCircle,
} from '@battleplans/ui';
import type { CategoryFormProps } from '../../registry/categories';
import { CATEGORY_BY_KEY } from '../../registry/categories';
import { saveCategoryContent } from '../../lib/packs';
import { useDebouncedSave } from '../../hooks/useDebouncedSave';
import type { SaveSection } from './SectionForm';

export interface ChecklistItem {
  text: string;
  url?: string;
}

/** Read whatever is stored, tolerating the empty and legacy-prose cases. */
export function readChecklist(content: unknown): ChecklistItem[] {
  const value = content as { items?: ChecklistItem[]; body?: string } | null | undefined;
  if (Array.isArray(value?.items)) return value.items;
  // A section that was prose before this editor existed: keep the words rather
  // than silently dropping them, as one item the organiser can split up.
  if (value?.body?.trim()) return [{ text: value.body.trim() }];
  return [];
}

const ChecklistSectionForm = ({
  pack, rows, categoryKey, reload, save: saveFn = saveCategoryContent,
}: CategoryFormProps & { save?: SaveSection }) => {
  const definition = CATEGORY_BY_KEY[categoryKey];
  const stored = readChecklist(rows[categoryKey]?.content);

  const { value: items, setValue: setItems, state } = useDebouncedSave<ChecklistItem[]>(
    stored,
    async next => {
      // Drop rows that are entirely blank — an empty bullet is not content, and
      // leaving them would publish a list with holes in it.
      const kept = next.filter(i => i.text.trim() || i.url?.trim());
      await saveFn(pack.id, categoryKey, kept.length ? { items: kept } : null);
      await reload();
    },
  );

  const update = (index: number, patch: Partial<ChecklistItem>) =>
    setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  return (
    <PanelSection
      title={definition?.label ?? 'Checklist'}
      action={state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved' : ''}
    >

      {definition?.formHint && (
        <p className="font-body text-xs text-gray-400">{definition.formHint}</p>
      )}

      {items.length === 0 && (
        <p className="font-body text-sm text-gray-500">
          Nothing on the list yet. One line per thing a player has to bring.
        </p>
      )}

      {/* The text field is the header, so the box's controls sit on the same
          line as the thing they act on rather than above it — a checklist item
          is one short phrase, and a header row of its own would double the
          height of every row to say nothing. */}
      {items.map((item, index) => (
        <EditableListItem
          key={index}
          index={index}
          count={items.length}
          removeLabel={`Remove item ${index + 1}`}
          onMove={delta => move(index, delta)}
          onRemove={() => setItems(items.filter((_, i) => i !== index))}
          header={
            <Input
              size="sm"
              placeholder={definition?.placeholder ?? 'Dice and a tape measure'}
              value={item.text}
              onChange={e => update(index, { text: e.target.value })}
            />
          }
        >
          <Input
            size="sm"
            type="url"
            inputMode="url"
            placeholder="https://… (optional)"
            value={item.url ?? ''}
            onChange={e => update(index, { url: e.target.value })}
          />
        </EditableListItem>
      ))}

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        leftIcon={<AddCircle className="w-4 h-4" />}
        onClick={() => setItems([...items, { text: '' }])}
      >
        Add Item
      </Button>
    </PanelSection>
  );
};

export default ChecklistSectionForm;
