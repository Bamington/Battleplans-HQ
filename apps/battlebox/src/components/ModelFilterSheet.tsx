import { useEffect, useState } from 'react';
import { Sheet, Button } from '@battleplans/ui';
import { Section, Accordion, DateRange, Chip, GameMultiSelect } from './filterControls';
import { useOwnedGames, EMPTY_MODEL_FILTERS, activeModelFilterCount } from '../hooks/useCollection';
import type { ModelFilters, ModelStatus } from '../hooks/useCollection';

const STATUSES: { value: ModelStatus; label: string }[] = [
  { value: 'None',              label: 'Unpainted' },
  { value: 'Assembled',         label: 'Assembled' },
  { value: 'Primed',            label: 'Primed' },
  { value: 'Partially Painted', label: 'Partially Painted' },
  { value: 'Painted',           label: 'Painted' },
];

export function ModelFilterSheet({ open, onClose, userId, value, onApply }: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  value: ModelFilters;
  onApply: (filters: ModelFilters) => void;
}) {
  const games = useOwnedGames(userId);
  const [draft, setDraft] = useState<ModelFilters>(value);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [paintedOpen,  setPaintedOpen]  = useState(false);

  // Reset the working copy to the applied filters each time the sheet opens.
  // Date accordions start collapsed, but open when that date already has a value.
  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setPurchaseOpen(!!(value.purchaseFrom || value.purchaseTo));
    setPaintedOpen(!!(value.paintedFrom || value.paintedTo));
  }, [open, value]);

  const toggleStatus = (s: ModelStatus) => setDraft(d => ({
    ...d, statuses: d.statuses.includes(s) ? d.statuses.filter(x => x !== s) : [...d.statuses, s],
  }));
  const toggleGame = (id: string) => setDraft(d => ({
    ...d, gameIds: d.gameIds.includes(id) ? d.gameIds.filter(x => x !== id) : [...d.gameIds, id],
  }));

  const count = activeModelFilterCount(draft);

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
            onClick={() => { setDraft(EMPTY_MODEL_FILTERS); setPurchaseOpen(false); setPaintedOpen(false); }}
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
        <h2 className="font-heading text-xl text-white">Filter Models</h2>
      </div>

      <div className="px-5 py-4 lg:overflow-y-auto lg:flex-1 lg:min-h-0 flex flex-col gap-6">
        <Section title="Painted Status" active={draft.statuses.length > 0} onReset={() => setDraft(d => ({ ...d, statuses: [] }))}>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(s => (
              <Chip key={s.value} label={s.label} selected={draft.statuses.includes(s.value)} onClick={() => toggleStatus(s.value)} />
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

        <hr className="border-neutral-800" />

        <Accordion
          title="Painted Date"
          active={!!(draft.paintedFrom || draft.paintedTo)}
          expanded={paintedOpen}
          onToggle={() => setPaintedOpen(o => !o)}
          onReset={() => setDraft(d => ({ ...d, paintedFrom: null, paintedTo: null }))}
        >
          <DateRange
            from={draft.paintedFrom} to={draft.paintedTo}
            onChange={(f, t) => setDraft(d => ({ ...d, paintedFrom: f, paintedTo: t }))}
          />
        </Accordion>
      </div>
    </Sheet>
  );
}
