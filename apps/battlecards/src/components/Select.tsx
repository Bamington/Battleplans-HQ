/**
 * Select.tsx — Dropdown select field component
 *
 * Wraps a native <select> element with the same visual language as Input:
 * label, required marker, helper text, left icon slot, and state-aware styling.
 * A chevron-down indicator is always rendered on the right — the native
 * browser arrow is suppressed via `appearance-none`.
 *
 * USAGE EXAMPLES:
 *   <Select label="Faction" options={[{ value: 'unsc', label: 'UNSC' }]} />
 *   <Select label="Size" required state="error" helperText="Please choose a size.">
 *     <option value="">Choose…</option>
 *     <option value="sm">Small</option>
 *   </Select>
 *   <Select state="success" helperText="Looks good!" value="unsc" onChange={…} />
 *   <Select size="lg" leftIcon={<Filter className="w-5 h-5" />} />
 *   <Select disabled />
 *   <Select readOnly value="unsc" />
 */

import React from 'react';
import AltArrowDown from '../icons/AltArrowDown';

// ── Type definitions ──────────────────────────────────────────────────────────

export type SelectSize  = 'sm' | 'base' | 'lg';
export type SelectState = 'default' | 'success' | 'error';

/** Convenience shape for the `options` prop */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Visual size of the select */
  size?: SelectSize;
  /** Validation state — affects border, background, and chevron colour */
  state?: SelectState;
  /** Label rendered above the select */
  label?: string;
  /** Shows a red asterisk after the label to indicate a required field */
  required?: boolean;
  /** Helper / validation message rendered below the select */
  helperText?: string;
  /** Icon or element rendered inside the select on the left */
  leftIcon?: React.ReactNode;
  /**
   * Convenience array of options.
   * If omitted, pass native <option> / <optgroup> elements as children instead.
   */
  options?: SelectOption[];
  /**
   * Prevents the value from being changed.
   * Note: <select> has no native readOnly attribute — this is simulated by
   * intercepting onChange and applying read-only visual styles.
   */
  readOnly?: boolean;
  /** Extra Tailwind classes on the <select> element */
  className?: string;
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

const sizeClasses: Record<SelectSize, string> = {
  sm:   'px-2.5 py-2   text-sm',
  base: 'px-3   py-2.5 text-sm',
  lg:   'px-3.5 py-3   text-base',
};

/** Left padding when a leftIcon is present */
const leftPaddingClasses: Record<SelectSize, string> = {
  sm:   'ps-9',
  base: 'ps-10',
  lg:   'ps-11',
};

/** Right padding reserved for the chevron — always applied */
const chevronPaddingClasses: Record<SelectSize, string> = {
  sm:   'pe-9',
  base: 'pe-10',
  lg:   'pe-11',
};

/** Size of the chevron icon */
const chevronSizeClasses: Record<SelectSize, string> = {
  sm:   'w-4 h-4',
  base: 'w-4 h-4',
  lg:   'w-5 h-5',
};

const stateClasses: Record<SelectState, string> = {
  default:
    'border-gray-300 bg-gray-50 text-gray-900 ' +
    'focus:ring-blue-500 focus:border-blue-500 ' +
    'dark:border-gray-600 dark:bg-gray-700 dark:text-white ' +
    'dark:focus:ring-blue-500 dark:focus:border-blue-500',
  success:
    'border-green-500 bg-green-50 text-gray-900 ' +
    'focus:ring-green-500 focus:border-green-500 ' +
    'dark:border-green-500 dark:bg-gray-700 dark:text-white ' +
    'dark:focus:ring-green-500 dark:focus:border-green-500',
  error:
    'border-red-500 bg-red-50 text-gray-900 ' +
    'focus:ring-red-500 focus:border-red-500 ' +
    'dark:border-red-500 dark:bg-gray-700 dark:text-white ' +
    'dark:focus:ring-red-500 dark:focus:border-red-500',
};

/** Applied when readOnly — visually distinct from disabled */
const readOnlyClasses =
  'border-gray-200 bg-gray-100 text-gray-500 cursor-default ' +
  'focus:ring-0 focus:border-gray-200 ' +
  'dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400 ' +
  'dark:focus:ring-0 dark:focus:border-gray-600';

const helperTextClasses: Record<SelectState, string> = {
  default: 'text-gray-500 dark:text-gray-400',
  success: 'text-green-600 dark:text-green-400',
  error:   'text-red-600   dark:text-red-400',
};

/** Chevron colour per state */
const chevronColorClasses: Record<SelectState, string> = {
  default: 'text-gray-500 dark:text-gray-400',
  success: 'text-green-600 dark:text-green-400',
  error:   'text-red-600   dark:text-red-400',
};

// ── Component ─────────────────────────────────────────────────────────────────

const Select = ({
  size      = 'base',
  state     = 'default',
  label,
  required  = false,
  helperText,
  leftIcon,
  options,
  children,
  disabled  = false,
  readOnly  = false,
  onChange,
  className = '',
  id,
  ...selectProps
}: SelectProps) => {

  const selectId = id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const selectClasses = [
    // Base — appearance-none hides the native browser arrow
    'appearance-none block w-full font-body rounded-lg border',
    'focus:ring-1 focus:outline-none transition-colors',
    sizeClasses[size],
    readOnly ? readOnlyClasses : stateClasses[state],
    leftIcon ? leftPaddingClasses[size] : '',
    chevronPaddingClasses[size],
    disabled            ? 'opacity-50 cursor-not-allowed' : '',
    readOnly && !disabled ? 'cursor-default'               : '',
    className,
  ].filter(Boolean).join(' ');

  // Intercept change events when in read-only mode
  const handleChange = readOnly
    ? (e: React.ChangeEvent<HTMLSelectElement>) => { e.preventDefault(); }
    : onChange;

  return (
    <div className="w-full">

      {/* Label */}
      {label && (
        <label
          htmlFor={selectId}
          className="block mb-2 text-sm font-medium font-body text-gray-900 dark:text-white"
        >
          {label}
          {required && <span className="text-red-500 ms-1">*</span>}
        </label>
      )}

      {/* Select wrapper */}
      <div className="relative">

        {/* Left icon */}
        {leftIcon && (
          <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-gray-500 dark:text-gray-400">
            {leftIcon}
          </div>
        )}

        <select
          id={selectId}
          disabled={disabled}
          onChange={handleChange}
          className={selectClasses}
          {...selectProps}
        >
          {options
            ? options.map(opt => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children
          }
        </select>

        {/* Chevron — always shown, pointer-events-none so it doesn't block clicks */}
        <div
          className={[
            'pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3',
            readOnly ? 'text-gray-400 dark:text-gray-600' : chevronColorClasses[state],
            disabled ? 'opacity-50' : '',
          ].filter(Boolean).join(' ')}
        >
          <AltArrowDown className={chevronSizeClasses[size]} />
        </div>

      </div>

      {/* Helper text */}
      {helperText && (
        <p className={`mt-2 text-sm font-body ${helperTextClasses[state]}`}>
          {helperText}
        </p>
      )}

    </div>
  );
};

export default Select;
