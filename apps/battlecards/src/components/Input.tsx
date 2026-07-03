/**
 * Input.tsx — Text input field component
 *
 * Wraps a native <input> element with consistent styling, optional label,
 * helper text, and left icon / right element slots.
 *
 * USAGE EXAMPLES:
 *   <Input label="Email" type="email" placeholder="name@example.com" />
 *   <Input state="error" helperText="Invalid email address." />
 *   <Input state="success" helperText="Looks good!" />
 *   <Input size="lg" leftIcon={<Search className="w-5 h-5" />} placeholder="Search units..." />
 *   <Input disabled value="Read-only value" />
 */

import React from 'react';

// ── Type definitions ──────────────────────────────────────────────────────────

export type InputSize  = 'sm' | 'base' | 'lg';
export type InputState = 'default' | 'success' | 'error';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visual size of the input */
  size?: InputSize;
  /** Validation state — affects border and background colours */
  state?: InputState;
  /** Label rendered above the input */
  label?: string;
  /** Shows a red asterisk after the label to indicate a required field */
  required?: boolean;
  /** Helper / validation message rendered below the input */
  helperText?: string;
  /** Icon or element rendered inside the input on the left */
  leftIcon?: React.ReactNode;
  /** Element rendered inside the input on the right (icon or button) */
  rightElement?: React.ReactNode;
  /** Extra Tailwind classes on the <input> element */
  className?: string;
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

const sizeClasses: Record<InputSize, string> = {
  sm:   'px-2.5 py-2   text-sm',
  base: 'px-3   py-2.5 text-sm',
  lg:   'px-3.5 py-3   text-base',
};

/** Extra left padding when a leftIcon is present — keeps text clear of the icon */
const leftPaddingClasses: Record<InputSize, string> = {
  sm:   'ps-9',
  base: 'ps-10',
  lg:   'ps-11',
};

/** Extra right padding when a rightElement is present */
const rightPaddingClasses: Record<InputSize, string> = {
  sm:   'pe-9',
  base: 'pe-10',
  lg:   'pe-11',
};

const stateClasses: Record<InputState, string> = {
  default:
    'border-gray-300 bg-gray-50 text-gray-900 ' +
    'focus:ring-blue-500 focus:border-blue-500 ' +
    'dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 ' +
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

/** Applied when readOnly is true — distinct from disabled, cannot be edited */
const readOnlyClasses =
  'border-gray-200 bg-gray-100 text-gray-500 cursor-default ' +
  'focus:ring-0 focus:border-gray-200 ' +
  'dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400 dark:placeholder-gray-500 ' +
  'dark:focus:ring-0 dark:focus:border-gray-600';

/** Colour of the helper text per state */
const helperTextClasses: Record<InputState, string> = {
  default: 'text-gray-500 dark:text-gray-400',
  success: 'text-green-600 dark:text-green-400',
  error:   'text-red-600 dark:text-red-400',
};

// ── Component ─────────────────────────────────────────────────────────────────

const Input = ({
  size         = 'base',
  state        = 'default',
  label,
  required     = false,
  helperText,
  leftIcon,
  rightElement,
  disabled     = false,
  readOnly     = false,
  className    = '',
  id,
  ...inputProps
}: InputProps) => {

  // Auto-generate a stable id when a label is provided so the <label> can
  // reference the input — falls back to the caller-supplied id.
  const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const inputClasses = [
    'block w-full font-body rounded-lg border focus:ring-1 focus:outline-none transition-colors',
    sizeClasses[size],
    readOnly ? readOnlyClasses : stateClasses[state],
    leftIcon     ? leftPaddingClasses[size]  : '',
    rightElement ? rightPaddingClasses[size] : '',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className="w-full">

      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="block mb-2 text-sm font-medium font-body text-gray-900 dark:text-white"
        >
          {label}
          {required && <span className="text-red-500 ms-1">*</span>}
        </label>
      )}

      {/* Input wrapper — needed to position icon/right element absolutely */}
      <div className="relative">

        {/* Left icon */}
        {leftIcon && (
          <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-gray-500 dark:text-gray-400">
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          disabled={disabled}
          readOnly={readOnly}
          className={inputClasses}
          {...inputProps}
        />

        {/* Right element */}
        {rightElement && (
          <div className="absolute inset-y-0 end-0 flex items-center pe-3">
            {rightElement}
          </div>
        )}

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

export default Input;
