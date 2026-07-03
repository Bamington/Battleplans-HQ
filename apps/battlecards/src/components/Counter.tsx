/**
 * Counter.tsx — Numeric stepper component
 *
 * A [−] value [+] control for integer inputs, with an optional label,
 * required marker, helper message, and validation state.
 *
 * Double-click the value to type a number directly. The edit commits on
 * blur or Enter; Escape cancels without saving. The result is clamped
 * to the min/max range.
 *
 * USAGE EXAMPLES:
 *   <Counter value={count} onChange={setCount} />
 *   <Counter value={count} onChange={setCount} min={0} max={10} />
 *   <Counter
 *     label="Model Count"
 *     required
 *     value={count}
 *     onChange={setCount}
 *     helperText="Maximum 10 models per unit."
 *   />
 *   <Counter state="error" helperText="Value out of range." value={0} onChange={setCount} />
 */

import { useState, useRef } from 'react';
import MinusCircle from '../icons/MinusCircle';
import AddCircle from '../icons/AddCircle';

// ── Type definitions ──────────────────────────────────────────────────────────

export type CounterState = 'default' | 'success' | 'error';

export interface CounterProps {
  /** Current numeric value (controlled) */
  value: number;
  /** Called with the new value when − or + is clicked */
  onChange: (value: number) => void;
  /** Minimum allowed value — disables − when reached */
  min?: number;
  /** Maximum allowed value — disables + when reached */
  max?: number;
  /** Label rendered above the counter */
  label?: string;
  /** Shows a red asterisk after the label */
  required?: boolean;
  /** Helper / validation message rendered below the counter */
  helperText?: string;
  /** Validation state — affects helper text colour */
  state?: CounterState;
  /** Extra Tailwind classes on the root element */
  className?: string;
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

const helperTextClasses: Record<CounterState, string> = {
  default: 'text-gray-500 dark:text-gray-400',
  success: 'text-green-600 dark:text-green-400',
  error:   'text-red-600   dark:text-red-400',
};

// ── Component ─────────────────────────────────────────────────────────────────

const Counter = ({
  value,
  onChange,
  min,
  max,
  label,
  required  = false,
  helperText,
  state     = 'default',
  className = '',
}: CounterProps) => {
  const canDecrement = min === undefined || value > min;
  const canIncrement = max === undefined || value < max;

  // ── Inline edit state ───────────────────────────────────────────────────
  const [editing, setEditing]   = useState(false);
  const [editVal, setEditVal]   = useState('');
  const inputRef                = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditVal(String(value));
    setEditing(true);
    // Focus after React renders the input
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const commitEdit = () => {
    setEditing(false);
    const parsed = parseInt(editVal, 10);
    if (isNaN(parsed)) return; // discard invalid input
    let clamped = parsed;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    if (clamped !== value) onChange(clamped);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  };

  const btnBase =
    'flex items-center justify-center w-7 h-7 rounded-full ' +
    'bg-primary-600 text-white transition-colors ' +
    'hover:bg-primary-700 ' +
    'focus:outline-none focus:ring-2 focus:ring-primary-300 dark:focus:ring-primary-800 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={`inline-flex flex-col gap-1.5 ${className}`}>

      {/* Label */}
      {label && (
        <label className="text-sm font-medium font-body text-gray-900 dark:text-white">
          {label}
          {required && <span className="text-red-500 ms-1">*</span>}
        </label>
      )}

      {/* Stepper row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canDecrement}
          onClick={() => canDecrement && onChange(value - 1)}
          className={btnBase}
          aria-label="Decrease"
        >
          <MinusCircle className="w-3.5 h-3.5" />
        </button>

        {editing ? (
          <input
            ref={inputRef}
            type="number"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onKeyDown}
            className="w-12 text-center text-sm font-medium font-body text-gray-900 dark:text-white bg-transparent border-b border-gray-400 dark:border-gray-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        ) : (
          <span
            className="min-w-[1.5rem] text-center text-sm font-medium font-body text-gray-900 dark:text-white cursor-text select-none"
            aria-live="polite"
            onDoubleClick={startEdit}
            title="Double-click to edit"
          >
            {value}
          </span>
        )}

        <button
          type="button"
          disabled={!canIncrement}
          onClick={() => canIncrement && onChange(value + 1)}
          className={btnBase}
          aria-label="Increase"
        >
          <AddCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Helper text */}
      {helperText && (
        <p className={`text-sm font-body ${helperTextClasses[state]}`}>
          {helperText}
        </p>
      )}

    </div>
  );
};

export default Counter;
