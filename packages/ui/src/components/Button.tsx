/**
 * Button.tsx — Interactive button component
 *
 * USAGE EXAMPLES:
 *   <Button>Save Card</Button>
 *   <Button variant="outline" color="danger">Delete</Button>
 *   <Button size="lg" shape="pill" color="success">Deploy Units</Button>
 *   <Button loading>Saving...</Button>
 *   <Button leftIcon={<Plus className="w-4 h-4" />}>Add Unit</Button>
 *   <Button variant="ghost" color="secondary" rightIcon={<ArrowRight className="w-4 h-4" />}>
 *     View details
 *   </Button>
 */

import React from 'react';

// ── Type definitions ──────────────────────────────────────────────────────────

/** Visual style of the button */
export type ButtonVariant = 'filled' | 'outline' | 'ghost';

/** Semantic colour role */
export type ButtonColor = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'dark';

/** Size of the button */
export type ButtonSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl';

/** Border-radius style */
export type ButtonShape = 'rounded' | 'pill';

export interface ButtonProps {
  /** Visual style — filled (default), outlined border, or transparent ghost */
  variant?: ButtonVariant;
  /** Semantic colour role */
  color?: ButtonColor;
  /** Size of the button */
  size?: ButtonSize;
  /** rounded (default) or pill (full radius) */
  shape?: ButtonShape;
  /** Icon rendered before the label text */
  leftIcon?: React.ReactNode;
  /** Icon rendered after the label text */
  rightIcon?: React.ReactNode;
  /** Shows a spinner and disables the button */
  loading?: boolean;
  /** Disables the button */
  disabled?: boolean;
  /** HTML button type attribute */
  type?: 'button' | 'submit' | 'reset';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Extra Tailwind classes for one-off tweaks */
  className?: string;
  children: React.ReactNode;
}

// ── Lookup tables ─────────────────────────────────────────────────────────────
//
// Full class strings (no template literals) so Tailwind's scanner picks
// up every class in the build.

const sizeClasses: Record<ButtonSize, string> = {
  xs:   'px-3   py-1.5 text-xs',
  sm:   'px-3   py-2   text-sm',
  base: 'px-4   py-2.5 text-sm',
  lg:   'px-5   py-3   text-base',
  xl:   'px-6   py-3.5 text-base',
};

const shapeClasses: Record<ButtonShape, string> = {
  rounded: 'rounded-lg',
  pill:    'rounded-full',
};

const colorClasses: Record<ButtonVariant, Record<ButtonColor, string>> = {
  filled: {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 ' +
      'dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800',
    secondary:
      'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-4 focus:ring-gray-100 ' +
      'dark:bg-gray-600 dark:text-white dark:hover:bg-gray-700 dark:focus:ring-gray-700',
    success:
      'bg-green-600 text-white hover:bg-green-700 focus:ring-4 focus:ring-green-300 ' +
      'dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800',
    danger:
      'bg-red-600 text-white hover:bg-red-700 focus:ring-4 focus:ring-red-300 ' +
      'dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900',
    warning:
      'bg-amber-400 text-white hover:bg-amber-500 focus:ring-4 focus:ring-amber-300 ' +
      'dark:focus:ring-amber-900',
    dark:
      'bg-gray-800 text-white hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 ' +
      'dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700',
  },
  outline: {
    primary:
      'border border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-4 focus:ring-blue-300 ' +
      'dark:border-blue-500 dark:text-blue-500 dark:hover:bg-blue-950 dark:focus:ring-blue-800',
    secondary:
      'border border-gray-400 text-gray-700 hover:bg-gray-50 focus:ring-4 focus:ring-gray-200 ' +
      'dark:border-gray-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:focus:ring-gray-700',
    success:
      'border border-green-600 text-green-600 hover:bg-green-50 focus:ring-4 focus:ring-green-300 ' +
      'dark:border-green-500 dark:text-green-500 dark:hover:bg-green-950 dark:focus:ring-green-800',
    danger:
      'border border-red-600 text-red-600 hover:bg-red-50 focus:ring-4 focus:ring-red-300 ' +
      'dark:border-red-500 dark:text-red-500 dark:hover:bg-red-950 dark:focus:ring-red-900',
    warning:
      'border border-amber-400 text-amber-600 hover:bg-amber-50 focus:ring-4 focus:ring-amber-300 ' +
      'dark:border-amber-400 dark:text-amber-400 dark:hover:bg-amber-950 dark:focus:ring-amber-900',
    dark:
      'border border-gray-800 text-gray-800 hover:bg-gray-100 focus:ring-4 focus:ring-gray-300 ' +
      'dark:border-gray-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:focus:ring-gray-700',
  },
  ghost: {
    primary:   'text-blue-600  hover:bg-blue-50   dark:text-blue-400  dark:hover:bg-blue-950',
    secondary: 'text-gray-600  hover:bg-gray-100  dark:text-gray-400  dark:hover:bg-gray-800',
    success:   'text-green-600 hover:bg-green-50  dark:text-green-400 dark:hover:bg-green-950',
    danger:    'text-red-600   hover:bg-red-50    dark:text-red-400   dark:hover:bg-red-950',
    warning:   'text-amber-600 hover:bg-amber-50  dark:text-amber-400 dark:hover:bg-amber-950',
    dark:      'text-gray-800  hover:bg-gray-100  dark:text-gray-300  dark:hover:bg-gray-800',
  },
};

// ── Spinner ───────────────────────────────────────────────────────────────────

/** Animated loading spinner — inherits the button's current text colour */
const Spinner = () => (
  <svg
    aria-hidden="true"
    className="w-4 h-4 animate-spin fill-current opacity-75"
    viewBox="0 0 100 101"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
      fill="currentColor"
      opacity=".25"
    />
    <path
      d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.45 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
      fill="currentColor"
    />
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────

const Button = ({
  variant   = 'filled',
  color     = 'primary',
  size      = 'base',
  shape     = 'rounded',
  leftIcon,
  rightIcon,
  loading   = false,
  disabled  = false,
  type      = 'button',
  onClick,
  className = '',
  children,
}: ButtonProps) => {
  const isDisabled = disabled || loading;

  const classes = [
    'inline-flex items-center justify-center gap-2 font-body font-medium transition-colors focus:outline-none',
    sizeClasses[size],
    shapeClasses[shape],
    colorClasses[variant][color],
    isDisabled ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={classes}
    >
      {loading ? <Spinner /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
};

export default Button;
