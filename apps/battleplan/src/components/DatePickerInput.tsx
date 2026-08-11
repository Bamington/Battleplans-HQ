/**
 * DatePickerInput — a styled display over a real <input type="date">
 *
 * The date is shown as "Saturday, 01/08/26" rather than the browser's own
 * rendering, which differs per platform and never matches the rest of the form.
 * The trick is that the pretty text is only paint: the actual control is a
 * full-size native date input sitting on top of it at opacity 0, so a tap or
 * click lands on the input itself and every platform opens its own picker.
 *
 * ── Why not showPicker() ─────────────────────────────────────────────────
 *
 * This component used to hide the input with `sr-only` and open it from a
 * click handler on the display:
 *
 *   onClick={() => inputRef.current?.showPicker?.()}
 *
 * showPicker() has never been implemented in Safari on iOS — not in old
 * versions, at any point through 26.x — so on every iPhone and iPad the
 * optional call resolved to undefined and no-opped. With the real input
 * clipped to 1x1 there was nothing else to tap, and the `?.` meant it failed
 * silently: no picker, no focus, no error. iOS users could not set a date at
 * all, which in the booking flow meant they could not book, because the
 * timeslot select only renders once a date exists.
 *
 * So the native input is now the tap target and needs no scripting to work.
 * showPicker() is still called where it exists, purely as an enhancement:
 * Chrome focuses a date segment rather than opening the calendar on a plain
 * click, and this keeps that one-click behaviour instead of regressing it.
 */

import { useId, useRef } from 'react';

function formatDateDisplay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dt.getDay()];
  return `${day}, ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${String(y).slice(2)}`;
}

export default function DatePickerInput({ label, value, min, onChange }: {
  label: string;
  value: string;
  min?: string;
  onChange: (val: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  /*
   * iOS Safari ignores `min` and `max` on date inputs, so the attribute alone
   * doesn't stop someone picking last Tuesday — it only greys the dates out on
   * platforms that honour it. The guard is repeated here in JS.
   *
   * ISO dates compare correctly as strings, so no parsing is needed, which
   * also avoids Safari's stricter Date() behaviour.
   */
  function handleChange(next: string) {
    if (min && next && next < min) {
      onChange(min);
      return;
    }
    onChange(next);
  }

  return (
    <div className="w-full">
      <label htmlFor={id} className="block mb-2 text-sm font-medium font-body dark:text-white">
        {label}
      </label>

      {/* The input is positioned against this box, so it can cover it exactly. */}
      <div className="relative w-full">
        <div
          className="block w-full font-body rounded-lg border px-3 py-2.5 text-sm cursor-pointer dark:border-gray-600 dark:bg-gray-700"
        >
          {value
            ? <span className="dark:text-white">{formatDateDisplay(value)}</span>
            : <span className="dark:text-gray-400">Select a date</span>
          }
        </div>

        {/*
          Invisible, but present and full-size — opacity rather than `sr-only`
          or `hidden`, both of which would take it out of hit testing and put
          us back where we started.

          appearance-none stops iOS imposing its own intrinsic height, which
          would otherwise leave the tappable area a different size from the box
          the user can see.
        */}
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          min={min}
          onChange={e => handleChange(e.target.value)}
          onClick={() => {
            // Enhancement only. Absent on iOS, and can throw NotAllowedError
            // if the browser decides the gesture doesn't warrant a picker.
            try { inputRef.current?.showPicker?.(); } catch { /* native picker still opens on tap */ }
          }}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent p-0 opacity-0"
        />
      </div>
    </div>
  );
}
