/**
 * Switch.tsx — an on/off toggle with its label. Moved out of the paint pack
 * editor so the "Painted by me" field can use it too.
 */

export function Switch({ checked, onChange, label, disabled = false }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className="flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-primary-600' : 'bg-neutral-700'}`}>
        <span className={`pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </span>
      <span className="font-body text-sm text-white">{label}</span>
    </button>
  );
}
