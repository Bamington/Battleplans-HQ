import { useEffect, useState } from 'react';
import { Sheet, Button } from '@battleplans/ui';
import { Section, Chip } from './filterControls';

/** Filter the Paint Packs column by one or more brands. */
export function PaintPackFilterSheet({ open, onClose, brands, value, onApply }: {
  open: boolean;
  onClose: () => void;
  /** All brands present in the pack list. */
  brands: string[];
  /** Currently-applied brand selection. */
  value: string[];
  onApply: (brands: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(value);

  useEffect(() => { if (open) setDraft(value); }, [open, value]);

  const toggle = (b: string) => setDraft(d => d.includes(b) ? d.filter(x => x !== b) : [...d, b]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      className="max-w-md"
      footer={
        <div className="px-5 py-4 border-t border-neutral-800 flex gap-3">
          <Button variant="outline" color="secondary" className="flex-1 justify-center" onClick={() => setDraft([])}>
            Reset All
          </Button>
          <Button color="primary" className="flex-1 justify-center" onClick={() => onApply(draft)}>
            Apply Filters{draft.length ? ` (${draft.length})` : ''}
          </Button>
        </div>
      }
    >
      <div className="px-5 pt-5 pb-1 shrink-0">
        <h2 className="font-heading text-xl text-white">Filter Packs</h2>
      </div>

      <div className="px-5 py-4 lg:overflow-y-auto lg:flex-1 lg:min-h-0 flex flex-col gap-6">
        <Section title="Brand" active={draft.length > 0} onReset={() => setDraft([])}>
          {brands.length === 0 ? (
            <p className="font-body text-sm text-neutral-500">No brands available.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {brands.map(b => (
                <Chip key={b} label={b} selected={draft.includes(b)} onClick={() => toggle(b)} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </Sheet>
  );
}
