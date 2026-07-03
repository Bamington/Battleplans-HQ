/**
 * MultiSelectDropdown.tsx — Multi-select field with checkbox list
 *
 * Matches the Select component's closed-state appearance (same label, border,
 * chevron, helper text). Opens a floating panel styled per Figma
 * "Dropdown / Menu" (node 240:7259) with checkbox items (node 240:7154).
 *
 * USAGE EXAMPLE:
 *   const OPTIONS = ['Agility', 'General', 'Passing'];
 *
 *   <MultiSelectDropdown
 *     label="Primary Attributes"
 *     required
 *     options={OPTIONS}
 *     selected={primary}
 *     disabledOptions={secondary}
 *     onChange={setPrimary}
 *   />
 */

import { useRef, useState, useEffect, useId } from 'react';
import AltArrowDown from '../icons/AltArrowDown';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MultiSelectDropdownProps {
  label?:           string;
  required?:        boolean;
  helperText?:      string;
  /** All available options */
  options:          string[];
  /** Currently selected values */
  selected:         string[];
  /** Options to render as disabled (already picked elsewhere) */
  disabledOptions?: string[];
  onChange:         (selected: string[]) => void;
  placeholder?:     string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const MultiSelectDropdown = ({
  label,
  required      = false,
  helperText,
  options,
  selected,
  disabledOptions = [],
  onChange,
  placeholder   = 'Select options',
}: MultiSelectDropdownProps) => {

  const [open, setOpen] = useState(false);
  const containerRef    = useRef<HTMLDivElement>(null);
  const uid             = useId();

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

  const toggle = (option: string) => {
    if (disabledOptions.includes(option)) return;
    onChange(
      selected.includes(option)
        ? selected.filter(s => s !== option)
        : [...selected, option]
    );
  };

  // Closed-state display text
  const displayText = selected.length > 0 ? selected.join(', ') : placeholder;
  const hasValue    = selected.length > 0;

  return (
    <div className="w-full" ref={containerRef}>

      {/* Label — matches Select */}
      {label && (
        <label
          htmlFor={uid}
          className="block mb-2 text-sm font-medium font-body text-gray-900 dark:text-white"
        >
          {label}
          {required && <span className="text-red-500 ms-1">*</span>}
        </label>
      )}

      {/* Trigger — mirrors Select's closed appearance */}
      <div className="relative">
        <button
          id={uid}
          type="button"
          onClick={() => setOpen(v => !v)}
          className={[
            'appearance-none block w-full font-body rounded-lg border text-left',
            'px-3 py-2.5 pe-10 text-sm',
            'border-gray-300 bg-gray-50 text-gray-900',
            'focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors',
            'dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-blue-500 dark:focus:border-blue-500',
            hasValue ? 'dark:text-white' : 'dark:text-gray-400 text-gray-400',
          ].join(' ')}
        >
          {displayText}
        </button>

        {/* Chevron */}
        <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-gray-500 dark:text-gray-400">
          <AltArrowDown className="w-4 h-4" />
        </div>

        {/* ── Dropdown panel — Figma "Dropdown / Menu" (240:7259) ─────────
            bg-gray-700, border-gray-600, rounded-xl, p-2, w-full */}
        {open && (
          <div className="absolute z-50 left-0 right-0 top-[calc(100%+4px)] bg-gray-700 border border-gray-600 rounded-xl p-2 flex flex-col gap-px shadow-lg">
            {options.map(option => {
              const isChecked  = selected.includes(option);
              const isDisabled = disabledOptions.includes(option);

              return (
                <button
                  key={option}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => toggle(option)}
                  className={[
                    'flex gap-1.5 items-center px-2 py-2 rounded-lg w-full text-left transition-colors',
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed'
                      : isChecked
                        ? 'bg-blue-950 hover:bg-blue-900'
                        : 'hover:bg-white/10',
                  ].join(' ')}
                >
                  {/* Label */}
                  <span className="flex-1 font-body font-medium text-sm leading-5 text-gray-50 min-w-0">
                    {option}
                  </span>

                  {/* Checkbox — Figma "Checkbox" (Default / Checked / Disabled) */}
                  <span
                    className={[
                      'shrink-0 w-4 h-4 rounded-[2.5px] border border-gray-500 flex items-center justify-center',
                      isDisabled  ? 'bg-[#818388]'  :
                      isChecked   ? 'bg-blue-500'   :
                                    'bg-white',
                    ].join(' ')}
                  >
                    {isChecked && !isDisabled && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Helper text — matches Select */}
      {helperText && (
        <p className="mt-2 text-sm font-body text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}

    </div>
  );
};

export default MultiSelectDropdown;
