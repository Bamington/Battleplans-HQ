/**
 * SearchSelect.tsx — Single-select searchable dropdown with per-option icons
 *
 * Matches the Select component's closed-state appearance (label, border,
 * chevron, helper text) but opens a floating panel containing a search box and
 * a scrollable list of options. Each option can render a leading icon, and the
 * selected option's icon is echoed in the closed trigger.
 *
 * USAGE:
 *   <SearchSelect
 *     label="Game"
 *     placeholder="Choose Game"
 *     searchPlaceholder="Search games…"
 *     value={gameId}
 *     onChange={setGameId}
 *     options={games.map(g => ({
 *       value: g.id,
 *       label: g.name,
 *       icon: <img src={icon} className="size-6 rounded object-contain" />,
 *     }))}
 *   />
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import AltArrowDown from '../icons/AltArrowDown';
import Magnifer from '../icons/Magnifer';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Optional leading icon element rendered in the row and the trigger */
  icon?: React.ReactNode;
}

export interface SearchSelectProps {
  label?:             string;
  required?:          boolean;
  helperText?:        string;
  placeholder?:       string;
  searchPlaceholder?: string;
  options:            SearchSelectOption[];
  /** Selected value ('' = none selected) */
  value:              string;
  onChange:           (value: string) => void;
  disabled?:          boolean;
  /** Message shown when the search matches no options */
  emptyLabel?:        string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const SearchSelect = ({
  label,
  required          = false,
  helperText,
  placeholder       = 'Select an option',
  searchPlaceholder = 'Search…',
  options,
  value,
  onChange,
  disabled          = false,
  emptyLabel        = 'No matches found.',
}: SearchSelectProps) => {

  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const containerRef        = useRef<HTMLDivElement>(null);
  const searchRef           = useRef<HTMLInputElement>(null);
  const uid                 = useId();

  const selected = useMemo(() => options.find(o => o.value === value) ?? null, [options, value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset + focus search when opening
  useEffect(() => {
    if (open) {
      setSearch('');
      // Focus after the panel paints
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const pick = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div className="w-full" ref={containerRef}>

      {/* Label */}
      {label && (
        <label
          htmlFor={uid}
          className="block mb-2 text-sm font-medium font-body text-gray-900 dark:text-white"
        >
          {label}
          {required && <span className="text-red-500 ms-1">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Trigger — mirrors Select's closed appearance */}
        <button
          id={uid}
          type="button"
          disabled={disabled}
          onClick={() => setOpen(v => !v)}
          className={[
            'appearance-none flex items-center gap-2 w-full font-body rounded-lg border text-left',
            'px-3 py-2.5 pe-10 text-sm',
            'border-gray-300 bg-gray-50 text-gray-900',
            'focus:ring-1 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-colors',
            'dark:border-gray-600 dark:bg-gray-700',
            selected ? 'dark:text-white' : 'dark:text-gray-400 text-gray-400',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {selected?.icon && (
            <span className="shrink-0 flex items-center">{selected.icon}</span>
          )}
          <span className="flex-1 min-w-0 truncate">
            {selected ? selected.label : placeholder}
          </span>
        </button>

        {/* Chevron */}
        <div
          className={[
            'pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3',
            'text-gray-500 dark:text-gray-400 transition-transform',
            open ? 'rotate-180' : '',
          ].join(' ')}
        >
          <AltArrowDown className="w-4 h-4" />
        </div>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute z-50 left-0 right-0 top-[calc(100%+4px)] bg-gray-700 border border-gray-600 rounded-xl p-2 flex flex-col gap-2 shadow-lg">

            {/* Search box */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-gray-400">
                <Magnifer className="w-4 h-4" />
              </div>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="block w-full font-body rounded-lg border ps-9 pe-3 py-2 text-sm
                           bg-gray-800 border-gray-600 text-white placeholder:text-gray-400
                           focus:ring-1 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Options */}
            <div className="flex flex-col gap-px max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="font-body text-sm text-gray-400 text-center py-3">{emptyLabel}</p>
              ) : (
                filtered.map(option => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => pick(option.value)}
                      className={[
                        'flex items-center gap-2.5 px-2 py-2 rounded-lg w-full text-left transition-colors',
                        isSelected ? 'bg-primary-950 hover:bg-primary-900' : 'hover:bg-white/10',
                      ].join(' ')}
                    >
                      {option.icon && (
                        <span className="shrink-0 flex items-center">{option.icon}</span>
                      )}
                      <span className="flex-1 min-w-0 font-body font-medium text-sm leading-5 text-gray-50 truncate">
                        {option.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Helper text */}
      {helperText && (
        <p className="mt-2 text-sm font-body text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}

    </div>
  );
};

export default SearchSelect;
