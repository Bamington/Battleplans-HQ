/**
 * FaqSectionForm.tsx — the right panel for the FAQ category.
 *
 * An FAQ is pairs, not prose. Typing questions and answers into one field and
 * relying on bold to separate them means the document has no idea which is
 * which, and cannot lay them out or ever do anything cleverer with them.
 *
 * Both halves are rich text: an answer routinely wants a list or a link, and a
 * question sometimes wants to emphasise the word that matters — "can I proxy
 * *unpainted* models?".
 *
 * Stored as `{ items: [{ question, answer }] }` on the category's jsonb, both
 * markdown. Still `section` storage; the shape inside is this category's own,
 * which is what the registry's key-to-form mapping is for.
 */

import {
  Button, PanelSection, RichTextEditor, EditableListItem,
  AddCircle,
} from '@battleplans/ui';
import type { CategoryFormProps } from '../../registry/categories';
import { CATEGORY_BY_KEY } from '../../registry/categories';
import { saveCategoryContent } from '../../lib/packs';
import { useDebouncedSave } from '../../hooks/useDebouncedSave';
import type { SaveSection } from './SectionForm';

export interface FaqItem {
  question: string;
  answer: string;
}

/** Read whatever is stored, tolerating the empty and legacy-prose cases. */
export function readFaq(content: unknown): FaqItem[] {
  const value = content as { items?: FaqItem[]; body?: string } | null | undefined;
  if (Array.isArray(value?.items)) return value.items;
  // Prose written before this editor existed becomes one answer with no
  // question, rather than being thrown away.
  if (value?.body?.trim()) return [{ question: '', answer: value.body }];
  return [];
}

const FaqSectionForm = ({
  pack, rows, categoryKey, reload, save: saveFn = saveCategoryContent,
}: CategoryFormProps & { save?: SaveSection }) => {
  const definition = CATEGORY_BY_KEY[categoryKey];
  const stored = readFaq(rows[categoryKey]?.content);

  const { value: items, setValue: setItems, state } = useDebouncedSave<FaqItem[]>(
    stored,
    async next => {
      // A pair with neither half written is not a question — drop it rather
      // than publishing an empty entry.
      const kept = next.filter(i => i.question.trim() || i.answer.trim());
      await saveFn(pack.id, categoryKey, kept.length ? { items: kept } : null);
      await reload();
    },
  );

  const update = (index: number, patch: Partial<FaqItem>) =>
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
      title={definition?.label ?? 'FAQ'}
      action={state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved' : ''}
    >

      {definition?.formHint && (
        <p className="font-body text-xs text-gray-400">{definition.formHint}</p>
      )}

      {items.length === 0 && (
        <p className="font-body text-sm text-gray-500">
          No questions yet. Add the ones you answer over and over in the group chat.
        </p>
      )}

      {items.map((item, index) => (
        <EditableListItem
          key={index}
          index={index}
          count={items.length}
          header={
            <span className="font-body text-xs font-bold uppercase tracking-[1.2px] text-gray-500">
              Question {index + 1}
            </span>
          }
          removeLabel={`Remove question ${index + 1}`}
          onMove={delta => move(index, delta)}
          onRemove={() => setItems(items.filter((_, i) => i !== index))}
        >
          <RichTextEditor
            value={item.question}
            onChange={question => update(index, { question })}
            placeholder="Can I proxy models?"
          />

          <RichTextEditor
            value={item.answer}
            onChange={answer => update(index, { answer })}
            placeholder="Yes, as long as it is clearly the right size and base."
          />
        </EditableListItem>
      ))}

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        leftIcon={<AddCircle className="w-4 h-4" />}
        onClick={() => setItems([...items, { question: '', answer: '' }])}
      >
        Add Question
      </Button>
    </PanelSection>
  );
};

export default FaqSectionForm;
