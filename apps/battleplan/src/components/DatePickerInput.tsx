import { useRef } from 'react';

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

  return (
    <div className="w-full">
      <label className="block mb-2 text-sm font-medium font-body dark:text-white">
        {label}
      </label>
      <div
        className="block w-full font-body rounded-lg border px-3 py-2.5 text-sm cursor-pointer dark:border-gray-600 dark:bg-gray-700"
        onClick={() => inputRef.current?.showPicker?.()}
      >
        {value
          ? <span className="dark:text-white">{formatDateDisplay(value)}</span>
          : <span className="dark:text-gray-400">Select a date</span>
        }
      </div>
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        onChange={e => onChange(e.target.value)}
        className="sr-only"
      />
    </div>
  );
}
