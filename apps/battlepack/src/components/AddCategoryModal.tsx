/**
 * AddCategoryModal.tsx — the Add Category picker.
 *
 * Lists the categories this pack could still show, drawn from the registry and
 * filtered by the pack's game, so a game-specific category never appears on a
 * pack for a different game.
 *
 * WHY IT FLAGS RETAINED CONTENT. Removing a category hides it and keeps what
 * was written, so re-adding brings the text back. That is the right behaviour —
 * losing a paragraph because someone tidied their left nav would be far worse —
 * but it means adding a category can silently resurface prose the organiser has
 * forgotten writing. So a category that still holds content says so, and this
 * is the only place that difference is visible.
 *
 * Composed from Sheet, Badge and Button: a bottom sheet on a phone and a
 * centred dialog on a desktop, which is what the picker wants on both.
 */

import { useState } from 'react';
import { Sheet, Badge, Button, Callout } from '@battleplans/ui';
import { addableCategories } from '../registry/categories';
import type { CategoryDefinition } from '../registry/categories';
import type { PackCategoryRow } from '../lib/packs';

export interface AddCategoryModalProps {
  open: boolean;
  onClose: () => void;
  /** The pack's game, so game-specific categories resolve correctly. */
  gameId: string;
  rows: Record<string, PackCategoryRow>;
  /** Add (or un-hide) the chosen category. */
  onAdd: (key: string) => Promise<void>;
}

const REQUIREMENT_NOTE: Record<CategoryDefinition['requirement'], string> = {
  mandatory: 'Always on',
  default:   'On by default',
  optional:  'Optional',
};

const AddCategoryModal = ({ open, onClose, gameId, rows, onAdd }: AddCategoryModalProps) => {
  const [busy,  setBusy]  = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = addableCategories(gameId, rows);

  async function choose(key: string) {
    setBusy(key);
    setError(null);
    try {
      await onAdd(key);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that category.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} className="max-w-md">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl text-white">Add a Category</h2>
          <p className="font-body text-sm text-gray-400">
            Every category is a section of the pack, an entry in the list on the
            left, and a form on the right.
          </p>
        </div>

        {error && <Callout flavour="bad" onDismiss={() => setError(null)}>{error}</Callout>}

        {options.length === 0 ? (
          <p className="font-body text-sm text-gray-500 py-2">
            This pack already shows every category available for its game.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {options.map(({ category, hasContent }) => (
              <button
                key={category.key}
                type="button"
                disabled={busy !== null}
                onClick={() => choose(category.key)}
                className="w-full flex items-start gap-3 p-3 rounded-lg border border-gray-700 bg-gray-800/60
                           hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed
                           text-left transition-colors cursor-pointer"
              >
                <span className="shrink-0 text-gray-400 mt-0.5">{category.icon}</span>

                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="font-body font-medium text-base text-white">{category.label}</span>
                  {category.formHint && (
                    <span className="font-body text-xs text-gray-400 line-clamp-2">{category.formHint}</span>
                  )}

                  <span className="flex items-center gap-1.5 pt-1">
                    <Badge color="gray">{REQUIREMENT_NOTE[category.requirement]}</Badge>
                    {/* The whole reason this picker is not a plain list. */}
                    {hasContent && <Badge color="primary">Has saved content</Badge>}
                  </span>
                </span>

                {busy === category.key && (
                  <span className="shrink-0 font-body text-xs text-gray-500">Adding…</span>
                )}
              </button>
            ))}
          </div>
        )}

        <Button variant="outline" color="secondary" className="w-full" onClick={onClose} disabled={busy !== null}>
          Done
        </Button>
      </div>
    </Sheet>
  );
};

export default AddCategoryModal;
