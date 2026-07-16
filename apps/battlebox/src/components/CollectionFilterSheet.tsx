import { useEffect, useState } from 'react';
import { Sheet, Button } from '@battleplans/ui';
import { Section, Accordion, DateRange, Chip, GameMultiSelect } from './filterControls';
import { useOwnedGames, EMPTY_COLLECTION_FILTERS, activeCollectionFilterCount } from '../hooks/useCollection';
import type { CollectionFilters, CollectionPaint } from '../hooks/useCollection';

const PAINT: { value: CollectionPaint; label: string }[] = [
  { value: 'fully',     label: 'Fully Painted' },
  { value: 'partial',   label: 'Partially Painted' },
  { value: 'unpainted', label: 'Unpainted' },
];

const TYPES: ('Box' | 'Collection')[] = ['Box', 'Collection'];

export function CollectionFilterSheet({ open, onClose, userId, value, onApply }: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  value: CollectionFilters;
  onApply: (filters: CollectionFilters) => void;
}) {
  const games = useOwnedGames(userId, 'boxes');
  const [draft, setDraft] = useState<CollectionFilters>(value);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setPurchaseOpen(!!(value.purchaseFrom || value.purchaseTo));
  }, [open, value]);

  const togglePaint = (p: CollectionPaint) => setDraft(d => ({
    ...d, paint: d.paint.includes(p) ? d.paint.filter(x => x !== p) : [...d.paint, p],
  }));
  const toggleType = (t: 'Box' | 'Collection') => setDraft(d => ({
    ...d, types: d.types.includes(t) ? d.types.filter(x => x !== t) : [...d.types, t],
  }));
  const toggleGame = (id: string) => setDraft(d => ({
    ...d, gameIds: d.gameIds.includes(id) ? d.gameIds.filter(x => x !== id) : [...d.gameIds, id],
  }));

  const count = activeCollectionFilterCount(draft);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      className="max-w-md"
      footer={
        <div className="px-5 py-4 border-t border-neutral-800 flex gap-3">
          <Button
            variant="outline"
            color="secondary"
            className="flex-1 justify-center"
            onClick={() => { setDraft(EMPTY_COLLECTION_FILTERS); setPurchaseOpen(false); }}
          >
            Reset All
          </Button>
          <Button color="primary" className="flex-1 justify-center" onClick={() => onApply(draft)}>
            Apply Filters{count ? ` (${count})` : ''}
          </Button>
        </div>
      }
    >
      <div className="px-5 pt-5 pb-1 shrink-0">
        <h2 className="font-heading text-xl text-white">Filter Collections</h2>
      </div>

      <div className="px-5 py-4 lg:overflow-y-auto lg:flex-1 lg:min-h-0 flex flex-col gap-6">
        <Section title="Painted Status" active={draft.paint.length > 0} onReset={() => setDraft(d => ({ ...d, paint: [] }))}>
          <div className="flex flex-wrap gap-2">
            {PAINT.map(p => (
              <Chip key={p.value} label={p.label} selected={draft.paint.includes(p.value)} onClick={() => togglePaint(p.value)} />
            ))}
          </div>
        </Section>

        <hr className="border-neutral-800" />

        <Section title="Type" active={draft.types.length > 0} onReset={() => setDraft(d => ({ ...d, types: [] }))}>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => (
              <Chip key={t} label={t} selected={draft.types.includes(t)} onClick={() => toggleType(t)} />
            ))}
          </div>
        </Section>

        <hr className="border-neutral-800" />

        <Section title="Game" active={draft.gameIds.length > 0} onReset={() => setDraft(d => ({ ...d, gameIds: [] }))}>
          <GameMultiSelect games={games} selected={draft.gameIds} onToggle={toggleGame} />
        </Section>

        <hr className="border-neutral-800" />

        <Accordion
          title="Purchase Date"
          active={!!(draft.purchaseFrom || draft.purchaseTo)}
          expanded={purchaseOpen}
          onToggle={() => setPurchaseOpen(o => !o)}
          onReset={() => setDraft(d => ({ ...d, purchaseFrom: null, purchaseTo: null }))}
        >
          <DateRange
            from={draft.purchaseFrom} to={draft.purchaseTo}
            onChange={(f, t) => setDraft(d => ({ ...d, purchaseFrom: f, purchaseTo: t }))}
          />
        </Accordion>
      </div>
    </Sheet>
  );
}
