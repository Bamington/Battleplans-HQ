/**
 * DatePickerInput — a month calendar that can refuse individual dates.
 *
 * ── Why this is not an <input type="date"> ───────────────────────────────
 *
 * It was one, for a long time, and the history is worth keeping because it
 * constrains what can replace it.
 *
 * The native input could only ever restrict a RANGE, through `min` and `max`.
 * A venue's real availability is not a range: a club meets on alternate
 * Fridays, a shop shuts on Mondays, a hall is closed for a fortnight in
 * August. Offering those dates and refusing them afterwards is the thing this
 * component exists to stop, so the native control had to go.
 *
 * What the native control was doing right, and what any replacement has to
 * keep: it was the TAP TARGET ITSELF. An earlier version hid the input with
 * `sr-only` and opened it from a click handler calling `showPicker()`, which
 * has never been implemented in iOS Safari — so on every iPhone the optional
 * call resolved to undefined and no-opped, silently. iOS users could not set a
 * date, and therefore could not book at all, because the timeslot select only
 * renders once a date exists.
 *
 * This grid has no such dependency: it is buttons, so it works wherever a tap
 * works. The cost is the native mobile date wheel, which is a real loss on a
 * phone — mitigated by making every day a proper 40px-plus target.
 *
 * ── What "disabled" means here ───────────────────────────────────────────
 *
 * `isDateBookable` answers whether the venue OPENS that day, not whether it is
 * full. A date where every table is already taken stays selectable on purpose:
 * greying it out would say "this shop is closed" when the truth is "you're too
 * late for that one", and the booking form says the latter properly.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AltArrowLeft, AltArrowRight } from '@battleplans/ui';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatDateDisplay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_NAMES[dt.getDay()]}, ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${String(y).slice(2)}`;
}

/** Local-time ISO. `new Date(iso)` parses as UTC and lands on the wrong day. */
function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The 42 cells of a month grid — six rows of seven, always.
 *
 * A fixed height stops the popover resizing as you page between a month that
 * needs five rows and one that needs six, which is otherwise a visible jump
 * every few clicks.
 */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());          // back up to the Sunday
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function DatePickerInput({ label, value, min, onChange, isDateBookable }: {
  label: string;
  value: string;
  min?: string;
  onChange: (val: string) => void;
  /**
   * Whether the venue ever opens on this date. Omitted means every date is
   * offered, which is what the non-booking callers want.
   */
  isDateBookable?: (iso: string) => boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // The month on show. Follows the chosen date when there is one so reopening
  // lands where you left off, rather than always snapping back to today.
  const [cursor, setCursor] = useState(() => {
    const base = value ? parseIso(value) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  useEffect(() => {
    if (!open || !value) return;
    const d = parseIso(value);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }, [open, value]);

  // Close on an outside click or Escape. Both, because either alone leaves one
  // obvious way to dismiss it not working.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  function dayState(d: Date) {
    const iso = toIso(d);
    const inMonth = d.getMonth() === cursor.month;
    // ISO dates compare correctly as strings, so no parsing is needed.
    const beforeMin = !!min && iso < min;
    const closed = !!isDateBookable && !isDateBookable(iso);
    return { iso, inMonth, disabled: beforeMin || closed, selected: iso === value };
  }

  const step = (by: number) => setCursor(c => {
    const d = new Date(c.year, c.month + by, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  return (
    <div className="w-full" ref={wrapRef}>
      <span id={`${id}-label`} className="block mb-2 text-sm font-medium font-body dark:text-white">
        {label}
      </span>

      <div className="relative w-full">
        <button
          type="button"
          aria-labelledby={`${id}-label`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          className="block w-full text-left font-body rounded-lg border px-3 py-2.5 text-sm cursor-pointer dark:border-gray-600 dark:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {value
            ? <span className="dark:text-white">{formatDateDisplay(value)}</span>
            : <span className="dark:text-gray-400">Select a date</span>
          }
        </button>

        {open && (
          <div
            role="dialog"
            aria-label="Choose a date"
            className="absolute z-30 mt-1 w-[19rem] max-w-[calc(100vw-2rem)] rounded-lg border border-neutral-700 bg-neutral-800 p-3 shadow-lg"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => step(-1)}
                className="p-1.5 rounded text-neutral-300 hover:text-white hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <AltArrowLeft className="w-4 h-4" />
              </button>
              <span className="font-heading text-sm text-white" aria-live="polite">
                {MONTHS[cursor.month]} {cursor.year}
              </span>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => step(1)}
                className="p-1.5 rounded text-neutral-300 hover:text-white hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <AltArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {DAY_NAMES.map(d => (
                <span key={d} className="text-center font-body text-[10px] uppercase tracking-wide text-neutral-500 py-1">
                  {d.slice(0, 2)}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {days.map(d => {
                const { iso, inMonth, disabled, selected } = dayState(d);
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    aria-current={selected ? 'date' : undefined}
                    onClick={() => { onChange(iso); setOpen(false); }}
                    className={[
                      'h-10 rounded font-body text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                      selected
                        ? 'bg-primary-600 text-white font-medium'
                        : disabled
                          // Struck through as well as dimmed: on a dark ground,
                          // low contrast alone reads as "not loaded yet".
                          ? 'text-neutral-600 line-through cursor-not-allowed'
                          : inMonth
                            ? 'text-neutral-50 hover:bg-neutral-700'
                            : 'text-neutral-500 hover:bg-neutral-700',
                    ].join(' ')}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            {isDateBookable && (
              <p className="font-body text-xs text-neutral-500 mt-2">
                Crossed-out days are ones this place doesn’t open.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
