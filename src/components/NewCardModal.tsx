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
import AltArrowLeft  from '../icons/AltArrowLeft';
import AltArrowRight from '../icons/AltArrowRight';
import Magnifer from '../icons/Magnifer';
import MenuDots from '../icons/MenuDots';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';

export interface NewCardModalTemplate {
  id:       string;
  name:     string;
  source?:  'pack' | 'library';
  packName?: string;
  addonSummary?: string;
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

const PAGE_SIZE = 5;

const NewCardModal = ({ open, onClose, templates, onNewBlank, onPickTemplate, onDeleteTemplate }: NewCardModalProps) => {
  const [search,    setSearch]    = useState('');
  const [picking,   setPicking]   = useState(false);
  const [page,      setPage]      = useState(0);
  const [tabFilter, setTabFilter] = useState<'pack' | 'library'>('pack');

  useEffect(() => {
    if (open) {
      setSearch('');
      setPicking(false);
      setPage(0);
      setTabFilter('pack');
    }
  }, [open]);

  const hasPackItems    = useMemo(() => templates.some(t => t.source === 'pack'),    [templates]);
  const hasLibraryItems = useMemo(() => templates.some(t => t.source === 'library'), [templates]);
  const showTabs        = hasPackItems && hasLibraryItems;

  const filtered = useMemo(() => {
    let list = showTabs ? templates.filter(t => t.source === tabFilter) : templates;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(t => t.name.toLowerCase().includes(q));
  }, [templates, search, showTabs, tabFilter]);

  // Reset to first page whenever the filtered list changes.
  useEffect(() => { setPage(0); }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

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

            {showTabs && (
              <div className="flex">
                {(['pack', 'library'] as const).map((tab, idx) => (
                  <button
                    key={tab}
                    type="button"
                    disabled={picking}
                    onClick={() => {
                      setTabFilter(tab);
                      setPage(0);
                    }}
                    className={[
                      'flex-1 font-body text-sm font-medium px-4 py-2.5 text-center transition-colors',
                      idx === 0 ? 'rounded-l-lg' : 'rounded-r-lg',
                      tabFilter === tab
                        ? 'bg-blue-600 text-white'
                        : 'border border-blue-500 text-blue-500',
                    ].join(' ')}
                  >
                    {tab === 'pack' ? 'From Packs' : 'Your Content'}
                  </button>
                ))}
              </div>
            )}

            {templates.length > PAGE_SIZE && (
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
                  No templates match &quot;{search}&quot;.
                </p>
              ) : (
                paginated.map(t => (
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
                      className={[
                        'flex-1 min-w-0 text-left disabled:cursor-not-allowed',
                        t.addonSummary ? 'py-[7px]' : 'py-[13px]',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2 min-w-0 w-full">
                        <p className="flex-1 min-w-0 font-heading text-[18px] leading-6 text-gray-300 group-hover:text-white transition-colors truncate">
                          {t.name}
                        </p>
                        {t.packName && (
                          <span className="shrink-0 font-body text-xs text-gray-500">{t.packName}</span>
                        )}
                      </div>
                      {t.addonSummary && (
                        <p className="font-body text-[12px] leading-4 text-gray-400 truncate w-full">
                          {t.addonSummary}
                        </p>
                      )}
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

            {totalPages > 1 && (
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  disabled={safePage === 0 || picking}
                  onClick={() => setPage(p => p - 1)}
                  className="size-9 flex items-center justify-center
                             bg-gray-900 border border-gray-700 rounded-l-lg
                             text-gray-400 hover:text-white hover:bg-gray-800
                             disabled:opacity-40 disabled:cursor-not-allowed
                             transition-colors"
                  aria-label="Previous page"
                >
                  <AltArrowLeft className="size-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={picking}
                    onClick={() => setPage(i)}
                    className={[
                      'size-9 flex items-center justify-center font-body text-sm',
                      'border-y border-r border-gray-700 transition-colors',
                      i === safePage
                        ? 'bg-gray-800 text-gray-50'
                        : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white',
                    ].join(' ')}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= totalPages - 1 || picking}
                  onClick={() => setPage(p => p + 1)}
                  className="size-9 flex items-center justify-center
                             bg-gray-900 border-y border-r border-gray-700 rounded-r-lg
                             text-gray-400 hover:text-white hover:bg-gray-800
                             disabled:opacity-40 disabled:cursor-not-allowed
                             transition-colors"
                  aria-label="Next page"
                >
                  <AltArrowRight className="size-4" />
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </Modal>
  );
};

export default NewCardModal;
