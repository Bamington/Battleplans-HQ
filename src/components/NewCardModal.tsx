/**
 * NewCardModal.tsx — Entry point when the user adds a card to a deck
 * that has existing templates.
 *
 * Shows:
 *   - a "New Blank Card" button (primary action)
 *   - an OR divider
 *   - a "Create from Template" list of the user's templates for this game,
 *     filtered by an optional search box
 *
 * The parent decides whether to open this modal — if the user has zero
 * templates for the game, the parent should skip straight to the blank
 * card path instead of showing an empty list.
 *
 * USAGE:
 *   <NewCardModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     templates={templates}
 *     onNewBlank={() => { setOpen(false); addBlankCard(); }}
 *     onPickTemplate={async (id) => { await createFromTemplate(id); setOpen(false); }}
 *   />
 */

import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import Dropdown, { DropdownItem } from './Dropdown';
import AddCircle from '../icons/AddCircle';
import Magnifer from '../icons/Magnifer';
import MenuDots from '../icons/MenuDots';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';

export interface NewCardModalTemplate {
  id:   string;
  name: string;
}

export interface NewCardModalProps {
  open:    boolean;
  onClose: () => void;
  /** The user's templates for this game. Pass an empty array if you still want to open the modal. */
  templates: NewCardModalTemplate[];
  /** Called when the user chooses "New Blank Card". Parent closes + creates. */
  onNewBlank: () => void;
  /** Called when the user picks a template. May be async (parent fetches + inserts). */
  onPickTemplate: (templateId: string) => void | Promise<void>;
  /** Called when the user chooses "Delete Template" from a template's ⋯ menu. */
  onDeleteTemplate?: (templateId: string) => void | Promise<void>;
}

const SEARCH_THRESHOLD = 5;

const NewCardModal = ({ open, onClose, templates, onNewBlank, onPickTemplate, onDeleteTemplate }: NewCardModalProps) => {
  const [search, setSearch]   = useState('');
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch('');
      setPicking(false);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(t => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  const handlePick = async (id: string) => {
    if (picking) return;
    setPicking(true);
    try {
      await onPickTemplate(id);
    } finally {
      setPicking(false);
    }
  };

  const hasTemplates = templates.length > 0;

  return (
    <Modal open={open} onClose={picking ? () => {} : onClose} className="max-w-md">
      <div className="p-5 flex flex-col gap-3">

        <h5 className="font-heading text-xl text-white">Create New Card</h5>

        <Button
          variant="outline"
          color="primary"
          leftIcon={<AddCircle className="size-4" />}
          className="w-full justify-center"
          disabled={picking}
          onClick={onNewBlank}
        >
          New Blank Card
        </Button>

        {hasTemplates && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="font-body text-sm font-medium text-gray-500">OR</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            <h5 className="font-heading text-xl text-white">Create from Template</h5>

            {templates.length > SEARCH_THRESHOLD && (
              <Input
                leftIcon={<Magnifer className="size-4" />}
                placeholder="Search for a Template"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            )}

            <div className="flex flex-col gap-2">
              {filtered.length === 0 ? (
                <p className="font-body text-sm text-gray-400 py-2 text-center">
                  No templates match “{search}”.
                </p>
              ) : (
                filtered.map(t => (
                  <div
                    key={t.id}
                    className={[
                      // Layout — no overflow-hidden so the Dropdown panel can escape
                      'group flex items-center gap-1.5 w-full px-[7px]',
                      'bg-gray-800 rounded-lg shadow-sm border border-blue-500',
                      'hover:border-blue-400 transition-colors',
                      picking ? 'opacity-50' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {/* Selectable body */}
                    <button
                      type="button"
                      disabled={picking}
                      onClick={() => handlePick(t.id)}
                      className="flex-1 min-w-0 py-[13px] text-left disabled:cursor-not-allowed"
                    >
                      <p className="font-heading text-[18px] leading-6 text-gray-300 group-hover:text-white transition-colors truncate">
                        {t.name}
                      </p>
                    </button>

                    {/* ⋯ menu — only shown when a delete handler is provided */}
                    {onDeleteTemplate && (
                      <div className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Dropdown
                          align="right"
                          menuClassName="w-40"
                          trigger={
                            <button
                              type="button"
                              aria-label="Template options"
                              disabled={picking}
                              className="p-1 flex items-center justify-center text-gray-300 hover:text-white disabled:cursor-not-allowed"
                            >
                              <MenuDots className="size-4" />
                            </button>
                          }
                        >
                          <DropdownItem
                            icon={<TrashBinMinimalistic className="size-4" />}
                            onClick={() => onDeleteTemplate(t.id)}
                            className="!text-red-400 hover:!text-red-300 dark:!text-red-400 dark:hover:!text-red-300"
                          >
                            Delete Template
                          </DropdownItem>
                        </Dropdown>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

      </div>
    </Modal>
  );
};

export default NewCardModal;
