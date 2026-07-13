/**
 * ColumnHeader.tsx — The header at the top of a dashboard column (Figma
 * "Column Header", 1014:21758).
 *
 *   [48px icon]  TITLE                      [◧|▦]   ← optional view toggle
 *   A short description of what the column holds.
 *
 * Replaces the old centred "icon over title over description" stack with a
 * left-aligned row. The icon node carries its own colour (e.g. text-primary-500)
 * so the header themes per app without knowing the palette.
 *
 * The `toggle` prop renders a compact two-option segmented switch on the right of
 * the title row. It's hidden entirely when the prop is omitted — only the
 * columns that need it (currently My Battles) pass one in.
 */

import type { ReactNode } from 'react';

export interface ColumnHeaderToggleOption {
  /** Stable identifier returned by onChange and compared against value. */
  id: string;
  /** Icon shown inside the button (rendered at 16px). */
  icon: ReactNode;
  /** Accessible label / tooltip — the button is icon-only. */
  label: string;
}

export interface ColumnHeaderToggle {
  /** Exactly two options: [left, right]. */
  options: [ColumnHeaderToggleOption, ColumnHeaderToggleOption];
  /** Currently-selected option id. */
  value: string;
  onChange: (id: string) => void;
}

export interface ColumnHeaderProps {
  /** 48px icon node — set its own colour (e.g. `className="w-12 h-12 text-primary-500"`). */
  icon: ReactNode;
  /** Column title (Heading / H5). */
  title: ReactNode;
  /** Supporting line beneath the title. Omit for a title-only header. */
  description?: ReactNode;
  /** Optional segmented view switch, shown at the top-right of the title row. */
  toggle?: ColumnHeaderToggle;
  /** Extra Tailwind classes on the root. */
  className?: string;
}

// ── Segmented view toggle ─────────────────────────────────────────────────────

function ViewToggle({ options, value, onChange }: ColumnHeaderToggle) {
  return (
    <div className="flex h-10 shrink-0" role="group">
      {options.map((opt, i) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={[
              'flex items-center justify-center px-3 h-full transition-colors',
              i === 0 ? 'rounded-l-lg' : 'rounded-r-lg -ml-px',
              active
                ? 'bg-primary-600 text-white relative z-10'
                : 'border border-primary-500 text-primary-500 hover:bg-primary-950',
            ].join(' ')}
          >
            <span className="flex size-4 items-center justify-center" aria-hidden="true">
              {opt.icon}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ColumnHeader({
  icon,
  title,
  description,
  toggle,
  className = '',
}: ColumnHeaderProps) {
  return (
    <div className={`flex flex-col gap-1 items-start w-full ${className}`.trim()}>

      <div className="flex gap-2 items-center w-full">
        <span className="shrink-0">{icon}</span>
        <h2 className="flex-1 min-w-0 font-heading text-xl leading-7 text-white truncate">
          {title}
        </h2>
        {toggle && <ViewToggle {...toggle} />}
      </div>

      {description && (
        <p className="w-full font-body text-sm leading-5 text-neutral-300">
          {description}
        </p>
      )}

    </div>
  );
}
