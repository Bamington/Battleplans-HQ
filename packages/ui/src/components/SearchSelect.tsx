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

import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AltArrowDown from '../icons/AltArrowDown';
import Magnifer from '../icons/Magnifer';

/** Panel geometry, in viewport coordinates (the panel is position:fixed). */
interface PanelPos {
  left:      number;
  width:     number;
  maxHeight: number;
  top?:      number;
  bottom?:   number;
}

/** Never squeeze the panel below this; flip it above the trigger instead. */
const MIN_PANEL_H = 180;
const GAP         = 4;   // breathing room between trigger and panel
const EDGE        = 8;   // keep the panel off the viewport edge

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Optional leading icon element rendered in the row and the trigger */
  icon?: React.ReactNode;
  /**
   * Draw a divider above this option, to separate a group (e.g. "recently used"
   * from the rest). Suppressed while searching, where the grouping no longer
   * describes what's on screen.
   */
  separatorBefore?: boolean;
}

interface SearchSelectBaseProps {
  label?:             string;
  required?:          boolean;
  helperText?:        string;
  placeholder?:       string;
  searchPlaceholder?: string;
  options:            SearchSelectOption[];
  disabled?:          boolean;
  /** Message shown when the search matches no options */
  emptyLabel?:        string;
}

/**
 * Single- or multi-select, discriminated on `multiple` so `value`/`onChange` are
 * correctly typed either way. Omitting `multiple` keeps the original behaviour.
 */
export type SearchSelectProps = SearchSelectBaseProps & (
  | {
      multiple?: false;
      /** Selected value ('' = none selected) */
      value:     string;
      onChange:  (value: string) => void;
    }
  | {
      multiple:  true;
      /** Selected values ([] = none selected) */
      value:     string[];
      onChange:  (values: string[]) => void;
    }
);

// ── Component ─────────────────────────────────────────────────────────────────

const SearchSelect = (props: SearchSelectProps) => {
  const {
    label,
    required          = false,
    helperText,
    placeholder       = 'Select an option',
    searchPlaceholder = 'Search…',
    options,
    disabled          = false,
    emptyLabel        = 'No matches found.',
  } = props;

  const multiple = props.multiple === true;

  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);
  const containerRef        = useRef<HTMLDivElement>(null);
  const triggerRef          = useRef<HTMLButtonElement>(null);
  const panelRef            = useRef<HTMLDivElement>(null);
  const searchRef           = useRef<HTMLInputElement>(null);
  const uid                 = useId();

  // Normalise both modes to an array so the list/trigger share one code path.
  const values = useMemo<string[]>(
    () => (props.multiple ? props.value : props.value ? [props.value] : []),
    [props.multiple, props.value],
  );

  const chosen = useMemo(
    () => options.filter(o => values.includes(o.value)),
    [options, values],
  );

  /** Single mode echoes the picked option's icon in the trigger. */
  const selected = multiple ? null : chosen[0] ?? null;

  // Close on outside click. The panel is portaled out of the container, so it
  // has to be checked separately or clicking an option would close the panel.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /**
   * Anchor the portaled panel to the trigger. Opens downward by default, flips
   * above when there isn't room below, and takes whatever height is going —
   * so a tall viewport shows a long list instead of a squashed one.
   */
  useLayoutEffect(() => {
    if (!open) { setPanelPos(null); return; }

    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();

      const below = window.innerHeight - r.bottom - GAP - EDGE;
      const above = r.top - GAP - EDGE;
      const flip  = below < MIN_PANEL_H && above > below;

      setPanelPos({
        left:      r.left,
        width:     r.width,
        maxHeight: Math.max(MIN_PANEL_H, flip ? above : below),
        ...(flip
          ? { bottom: window.innerHeight - r.top + GAP }
          : { top: r.bottom + GAP }),
      });
    };

    place();
    // `true` so this also fires for scrolls inside a modal body, not just the page.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

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
    if (props.multiple) {
      // Toggle, and keep the panel open so several can be picked in one go.
      const next = values.includes(val) ? values.filter(v => v !== val) : [...values, val];
      props.onChange(next);
      return;
    }
    props.onChange(val);
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
          ref={triggerRef}
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
            chosen.length > 0 ? 'dark:text-white' : 'dark:text-gray-400 text-gray-400',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {selected?.icon && (
            <span className="shrink-0 flex items-center">{selected.icon}</span>
          )}
          <span className="flex-1 min-w-0 truncate">
            {chosen.length === 0 ? placeholder : chosen.map(o => o.label).join(', ')}
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

        {/* Panel — portaled to document.body so no overflow ancestor (a modal
            body, a scrolling column) can clip it. Geometry comes from panelPos. */}
        {open && panelPos && createPortal(
          <div
            ref={panelRef}
            style={{
              left:      panelPos.left,
              width:     panelPos.width,
              maxHeight: panelPos.maxHeight,
              ...(panelPos.top    !== undefined ? { top: panelPos.top }       : {}),
              ...(panelPos.bottom !== undefined ? { bottom: panelPos.bottom } : {}),
            }}
            className="fixed z-[60] bg-gray-700 border border-gray-600 rounded-xl p-2 flex flex-col gap-2 shadow-lg overflow-hidden"
          >

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

            {/* Options — flexes into whatever height the panel was given. */}
            <div className="flex flex-col gap-px flex-1 min-h-0 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="font-body text-sm text-gray-400 text-center py-3">{emptyLabel}</p>
              ) : (
                filtered.map(option => {
                  const isSelected = values.includes(option.value);
                  return (
                    <Fragment key={option.value}>
                    {option.separatorBefore && !search.trim() && (
                      <div role="separator" className="my-1 border-t border-gray-600" />
                    )}
                    <button
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

                      {/* Multi mode gets a trailing checkbox, matching
                          MultiSelectDropdown's Figma "Checkbox". */}
                      {multiple && (
                        <span
                          className={[
                            'shrink-0 w-4 h-4 rounded-[2.5px] border border-gray-500 flex items-center justify-center',
                            isSelected ? 'bg-primary-500' : 'bg-white',
                          ].join(' ')}
                        >
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                      )}
                    </button>
                    </Fragment>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
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
