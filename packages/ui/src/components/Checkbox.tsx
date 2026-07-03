/**
 * Checkbox.tsx — Checkbox input component
 *
 * USAGE EXAMPLES:
 *   <Checkbox label="Accept terms" />
 *   <Checkbox color="green" label="Mark as complete" defaultChecked />
 *   <Checkbox indeterminate label="Select all" />
 *   <Checkbox disabled label="Not available" />
 *   <Checkbox
 *     label="Deploy units"
 *     helperText="Requires at least one unit in reserve."
 *     color="primary"
 *   />
 */

import React, { useRef, useEffect } from 'react';

// ── Type definitions ──────────────────────────────────────────────────────────

export type CheckboxColor =
  | 'primary' | 'red' | 'green' | 'purple' | 'teal' | 'yellow';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Accent colour of the checkbox */
  color?: CheckboxColor;
  /** Label rendered to the right of the checkbox */
  label?: React.ReactNode;
  /** Secondary text rendered below the label */
  helperText?: string;
  /**
   * Sets the native indeterminate state — used for "select all" patterns.
   * Not reflected via the value; controlled via this prop.
   */
  indeterminate?: boolean;
  /** Extra Tailwind classes on the <input> element */
  className?: string;
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

/**
 * Checkbox accent colour — controls the fill when checked.
 * Uses CSS `accent-color` which is supported in all modern browsers.
 */
const accentClasses: Record<CheckboxColor, string> = {
  primary: 'accent-blue-600   dark:accent-blue-500',
  red:     'accent-red-600    dark:accent-red-500',
  green:   'accent-green-600  dark:accent-green-500',
  purple:  'accent-purple-600 dark:accent-purple-500',
  teal:    'accent-teal-600   dark:accent-teal-500',
  yellow:  'accent-yellow-400 dark:accent-yellow-400',
};

// ── Component ─────────────────────────────────────────────────────────────────

const Checkbox = ({
  color         = 'primary',
  label,
  helperText,
  indeterminate = false,
  disabled      = false,
  className     = '',
  id,
  ...inputProps
}: CheckboxProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // The indeterminate state cannot be set via HTML attributes — it must be
  // applied to the DOM element directly through JavaScript.
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const checkboxId = id ?? (label && typeof label === 'string'
    ? `checkbox-${label.toLowerCase().replace(/\s+/g, '-')}`
    : undefined);

  const inputClasses = [
    'w-4 h-4 rounded-sm border border-gray-300 bg-gray-100',
    'focus:ring-2 focus:outline-none',
    'dark:border-gray-600 dark:bg-gray-700',
    accentClasses[color],
    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    className,
  ].filter(Boolean).join(' ');

  // Render without a label — just the checkbox input
  if (!label && !helperText) {
    return (
      <input
        ref={inputRef}
        id={checkboxId}
        type="checkbox"
        disabled={disabled}
        className={inputClasses}
        {...inputProps}
      />
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center h-5 mt-0.5">
        <input
          ref={inputRef}
          id={checkboxId}
          type="checkbox"
          disabled={disabled}
          className={inputClasses}
          {...inputProps}
        />
      </div>

      {(label || helperText) && (
        <div>
          {label && (
            <label
              htmlFor={checkboxId}
              className={[
                'text-sm font-medium font-body text-gray-900 dark:text-gray-300',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {label}
            </label>
          )}
          {helperText && (
            <p className="text-xs font-body text-gray-500 dark:text-gray-400 mt-0.5">
              {helperText}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Checkbox;
