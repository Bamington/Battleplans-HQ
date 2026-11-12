/**
 * bench/modelParts.tsx — the read-only building blocks of a model's detail
 * view: the Details/Painting/Lore tabs, paint rows, recipe groups, labels and
 * the desk progress bar. BattleBench's model modal uses them with its own edit
 * controls added; the read-only views (share links, profiles) use them bare.
 */

import Badge, { type BadgeColor } from '../components/Badge';
import InfoCircle from '../icons/InfoCircle';
import FileText from '../icons/FileText';
import { DESK_STEPS, type ModelRecipeGroup, type ModelStatus, type PaintRef } from './types';

/** "2026-04-25" -> "25/04/26" */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

export const PaintRollerIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="2.5" width="9" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <path d="M11 4.5h2a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1H7a1 1 0 0 0-1 1V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="4.5" y="10" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

// ── Field labels ──────────────────────────────────────────────────────────────

export const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block font-body text-sm font-medium text-white">{children}</label>
);

// ── Paint row ─────────────────────────────────────────────────────────────────

const HEX = /^#[0-9a-fA-F]{6}$/;

/** The bordered frame around one group on the Painting tab. */
export const PAINT_FRAME = 'bg-neutral-900 border border-neutral-700 rounded-lg';

export function PaintRow({ paint, menu }: { paint: PaintRef; menu?: React.ReactNode }) {
  const typeColor: BadgeColor = paint.type.toLowerCase() === 'spray' ? 'warning' : 'purple';
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5">
      <span
        className="mt-0.5 w-4 h-4 rounded-full shrink-0 border border-neutral-600"
        style={HEX.test(paint.swatch ?? '') ? { backgroundColor: paint.swatch! } : undefined}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-body text-sm text-white truncate flex-1 min-w-0">{paint.name}</span>
          <Badge color="gray">{paint.brand}</Badge>
          <Badge color={typeColor}>{paint.type}</Badge>
        </div>
        {paint.note && <span className="font-body text-xs text-neutral-400">{paint.note}</span>}
      </div>
      {menu}
    </div>
  );
}

export function RecipeGroup({ recipe, menu, onOpenPhoto }: {
  recipe: ModelRecipeGroup;
  menu?: React.ReactNode;
  /** Open the recipe's photos in the lightbox at this index. */
  onOpenPhoto?: (index: number) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <PaintRollerIcon className="w-4 h-4 text-primary-400 shrink-0" />
        <span className="font-heading text-sm text-white flex-1 min-w-0 truncate">{recipe.name}</span>
        <Badge color="primary">Recipe</Badge>
        {menu}
      </div>
      {recipe.description && <p className="px-3 pb-1 font-body text-xs text-neutral-400">{recipe.description}</p>}
      {recipe.images.length > 0 && (
        <div className="flex gap-1.5 px-3 pt-1 pb-1.5 overflow-x-auto">
          {recipe.images.map((url, i) => (
            <button key={url} type="button" onClick={() => onOpenPhoto?.(i)} aria-label={`View photo ${i + 1} of ${recipe.name}`}
              className="shrink-0 w-14 h-14 rounded-md overflow-hidden border border-neutral-700 hover:border-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {recipe.paints.map((p, i) => <PaintRow key={i} paint={p} />)}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

export type Tab = 'details' | 'painting' | 'lore';

export function TabControl({ tab, onChange, show }: {
  tab: Tab;
  onChange: (t: Tab) => void;
  /** Only these tabs (in the usual order) — e.g. the share page hides empty
   *  ones. All three when left out. */
  show?: Tab[];
}) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = ([
    { id: 'details',  label: 'Details',  icon: <InfoCircle className="w-4 h-4" /> },
    { id: 'painting', label: 'Painting', icon: <PaintRollerIcon /> },
    { id: 'lore',     label: 'Lore',     icon: <FileText className="w-4 h-4" /> },
  ] as { id: Tab; label: string; icon: React.ReactNode }[]).filter(t => !show || show.includes(t.id));
  return (
    <div className="flex w-full">
      {tabs.map((t, i) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 font-body font-medium text-sm transition-colors',
              i === 0 ? 'rounded-l-lg' : i === tabs.length - 1 ? 'rounded-r-lg -ml-px' : '-ml-px',
              active ? 'bg-primary-600 text-white relative z-10' : 'border border-primary-500 text-primary-500 hover:bg-primary-950',
            ].join(' ')}
          >
            {t.icon}{t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Desk progress ─────────────────────────────────────────────────────────────

const STEP_LABEL: Record<ModelStatus, string> = {
  'None': 'Unpainted',
  'Assembled': 'Assembled',
  'Primed': 'Primed',
  'Partially Painted': 'Partially Painted',
  'Painted': 'Painted',
};

/** Four segments, filled up to and including the current stage. */
export function DeskProgress({ status }: { status: ModelStatus }) {
  const at = Math.max(0, DESK_STEPS.indexOf(status));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1" role="img" aria-label={`${STEP_LABEL[status]} — step ${at + 1} of ${DESK_STEPS.length}`}>
        {DESK_STEPS.map((s, i) => (
          <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= at ? 'bg-primary-500' : 'bg-neutral-700'}`} />
        ))}
      </div>
      <span className="font-body text-xs text-neutral-300">{STEP_LABEL[status]}</span>
    </div>
  );
}
