import { useEffect, useState } from 'react';
import { Sheet, Button } from '@battleplans/ui';
import { Section, Chip } from './filterControls';
import { EMPTY_RECIPE_FILTERS, RECIPE_SORTS, activeRecipeFilterCount } from '../hooks/useCollection';
import type { RecipeFilters } from '../hooks/useCollection';

/** Sort the Recipes column, and filter it to recipes using paints from
 *  chosen brands. Same shape as the Models / Collections sheets. */
export function RecipeFilterSheet({ open, onClose, brands, value, onApply }: {
  open: boolean;
  onClose: () => void;
  /** Every brand used across the user's recipes. */
  brands: string[];
  value: RecipeFilters;
  onApply: (filters: RecipeFilters) => void;
}) {
  const [draft, setDraft] = useState<RecipeFilters>(value);

  useEffect(() => { if (open) setDraft(value); }, [open, value]);

  const toggleBrand = (b: string) => setDraft(d => ({
    ...d, brands: d.brands.includes(b) ? d.brands.filter(x => x !== b) : [...d.brands, b],
  }));
  const count = activeRecipeFilterCount(draft);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      className="max-w-md"
      footer={
        <div className="px-5 py-4 border-t border-neutral-800 flex gap-3">
          <Button variant="outline" color="secondary" className="flex-1 justify-center" onClick={() => setDraft(EMPTY_RECIPE_FILTERS)}>
            Reset All
          </Button>
          <Button color="primary" className="flex-1 justify-center" onClick={() => onApply(draft)}>
            Apply Filters{count ? ` (${count})` : ''}
          </Button>
        </div>
      }
    >
      <div className="px-5 pt-5 pb-1 shrink-0">
        <h2 className="font-heading text-xl text-white">Sort &amp; Filter Recipes</h2>
      </div>

      <div className="px-5 py-4 lg:overflow-y-auto lg:flex-1 lg:min-h-0 flex flex-col gap-6">
        <Section title="Sort By" active={draft.sort !== 'added_desc'} onReset={() => setDraft(d => ({ ...d, sort: 'added_desc' }))}>
          <div className="flex flex-wrap gap-2">
            {RECIPE_SORTS.map(s => (
              <Chip key={s.value} label={s.label} selected={draft.sort === s.value} onClick={() => setDraft(d => ({ ...d, sort: s.value }))} />
            ))}
          </div>
        </Section>

        <hr className="border-neutral-800" />

        <Section title="Paint Brand" active={draft.brands.length > 0} onReset={() => setDraft(d => ({ ...d, brands: [] }))}>
          {brands.length === 0 ? (
            <p className="font-body text-sm text-neutral-500">Your recipes don't use any paints yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {brands.map(b => (
                <Chip key={b} label={b} selected={draft.brands.includes(b)} onClick={() => toggleBrand(b)} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </Sheet>
  );
}
