import { useEffect, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { Select, Badge, InfoCircle, FileText } from '@battleplans/ui';
import type { BadgeColor } from '@battleplans/ui';
import { GAME_ICONS } from './gameIcons';
import { BoxItem } from './BoxItem';
import { ImageCarousel } from './ImageCarousel';
import { useModelDetail, updateModel } from '../hooks/useCollection';
import type { ModelDetail, ModelStatus, PaintRef, ModelRecipeGroup } from '../hooks/useCollection';

// ── Icons ─────────────────────────────────────────────────────────────────────

const PaintRollerIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="2.5" width="9" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <path d="M11 4.5h2a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1H7a1 1 0 0 0-1 1V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="4.5" y="10" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const BoxMiniIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M8 2 14 5v6l-6 3-6-3V5l6-3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M2 5l6 3 6-3M8 8v6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);

const CalendarIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

// ── Status ────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ModelStatus; label: string }[] = [
  { value: 'None',              label: 'Unpainted' },
  { value: 'Assembled',         label: 'Assembled' },
  { value: 'Primed',            label: 'Primed' },
  { value: 'Partially Painted', label: 'Partially Painted' },
  { value: 'Painted',           label: 'Painted' },
];

// ── Date helper ───────────────────────────────────────────────────────────────

/** "2026-04-25" -> "25/04/26" */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

// ── Inline-editing fields (auto-save on blur) ─────────────────────────────────

function AutoInput({ value, onSave, placeholder }: {
  value: string | null;
  onSave: (v: string | null) => void;
  placeholder?: string;
}) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  return (
    <input
      type="text"
      value={v}
      placeholder={placeholder}
      onChange={e => setV(e.target.value)}
      onBlur={() => { if ((value ?? '') !== v) onSave(v.trim() || null); }}
      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
  );
}

function AutoTextarea({ value, onSave, placeholder, rows = 4 }: {
  value: string | null;
  onSave: (v: string | null) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  return (
    <textarea
      value={v}
      rows={rows}
      placeholder={placeholder}
      onChange={e => setV(e.target.value)}
      onBlur={() => { if ((value ?? '') !== v) onSave(v.trim() || null); }}
      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 font-body text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
  );
}

// ── Field labels / section headers ────────────────────────────────────────────

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block font-body text-sm font-medium text-white">{children}</label>
);

const TabIntro = ({ children }: { children: React.ReactNode }) => (
  <p className="font-body text-sm text-neutral-400 text-center">{children}</p>
);

// ── Paint row ─────────────────────────────────────────────────────────────────

const HEX = /^#[0-9a-fA-F]{6}$/;

function PaintRow({ paint }: { paint: PaintRef }) {
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
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'details' | 'painting' | 'lore';

function TabControl({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'details',  label: 'Details',  icon: <InfoCircle className="w-4 h-4" /> },
    { id: 'painting', label: 'Painting', icon: <PaintRollerIcon /> },
    { id: 'lore',     label: 'Lore',     icon: <FileText className="w-4 h-4" /> },
  ];
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

function DetailsTab({ model }: { model: ModelDetail }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg flex flex-col divide-y divide-neutral-800">
        <div className="flex items-center gap-2 px-3 py-2.5 text-primary-400">
          <BoxMiniIcon />
          <span className="font-body text-sm text-white">{model.count} {model.count === 1 ? 'Model' : 'Models'}</span>
        </div>
        {model.purchaseDate && (
          <div className="flex items-center gap-2 px-3 py-2.5 text-primary-400">
            <CalendarIcon />
            <span className="font-body text-sm text-white">Purchased {shortDate(model.purchaseDate)}</span>
          </div>
        )}
        {model.paintedDate && (
          <div className="flex items-center gap-2 px-3 py-2.5 text-primary-400">
            <PaintRollerIcon />
            <span className="font-body text-sm text-white">Painted {shortDate(model.paintedDate)}</span>
          </div>
        )}
      </div>

      {model.includedIn.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="font-body text-sm text-neutral-400">Included in:</span>
          {model.includedIn.map(b => <BoxItem key={b.id} box={b} />)}
        </div>
      )}
    </div>
  );
}

function PaintingTab({ model, save }: { model: ModelDetail; save: (p: { status?: ModelStatus; painting_notes?: string | null }) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <TabIntro>Record your hobby progress, and keep notes for the future.</TabIntro>

      <div className="flex flex-col gap-2">
        <Label>Painted Status</Label>
        <Select
          size="sm"
          className="w-full"
          value={model.status}
          onChange={e => save({ status: e.target.value as ModelStatus })}
          options={STATUS_OPTIONS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Painting Notes</Label>
        <AutoTextarea
          value={model.paintingNotes}
          onSave={v => save({ painting_notes: v })}
          placeholder="How did you paint it? Notes to your future self…"
          rows={4}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Paints Used</Label>
        {model.recipes.length === 0 && model.directPaints.length === 0 ? (
          <p className="font-body text-sm text-neutral-500 py-2">No paints recorded yet.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg divide-y divide-neutral-800">
            {model.recipes.map((r: ModelRecipeGroup, i) => (
              <RecipeGroup key={`r${i}`} recipe={r} />
            ))}
            {model.directPaints.map((p, i) => <PaintRow key={`p${i}`} paint={p} />)}
          </div>
        )}
      </div>
      {/* Add Recipe / Add Item are a later pass. */}
    </div>
  );
}

function RecipeGroup({ recipe }: { recipe: ModelRecipeGroup }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <PaintRollerIcon className="w-4 h-4 text-primary-400" />
        <span className="font-heading text-sm text-white">{recipe.name}</span>
        <Badge color="primary">Recipe</Badge>
      </div>
      {recipe.description && <p className="px-3 pb-1 font-body text-xs text-neutral-400">{recipe.description}</p>}
      {recipe.paints.map((p, i) => <PaintRow key={i} paint={p} />)}
    </div>
  );
}

function LoreTab({ model, save }: { model: ModelDetail; save: (p: { lore_name?: string | null; lore_description?: string | null }) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <TabIntro>Tell the story of this model.</TabIntro>
      <div className="flex flex-col gap-2">
        <Label>Name</Label>
        <AutoInput value={model.loreName} onSave={v => save({ lore_name: v })} placeholder="A name for this model…" />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Lore Description</Label>
        <AutoTextarea value={model.loreDescription} onSave={v => save({ lore_description: v })} placeholder="Their story, deeds, and fate…" rows={5} />
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function ModelDetailModal({ modelId, onClose, onChanged }: {
  modelId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { model, refetch } = useModelDetail(modelId);
  const [tab, setTab] = useState<Tab>('details');

  // Open on Details each time a model is opened.
  useEffect(() => { if (modelId) setTab('details'); }, [modelId]);

  const save = async (patch: { status?: ModelStatus; painting_notes?: string | null; lore_name?: string | null; lore_description?: string | null }) => {
    if (!modelId) return;
    await updateModel(modelId, patch);
    refetch();
    onChanged?.();
  };

  const iconUrl = model?.game?.slug ? GAME_ICONS[model.game.slug] ?? null : null;
  const open = modelId !== null;

  // Below lg the modal is a bottom sheet (slide up, drag-handle to dismiss,
  // one continuous scroll); at lg+ it stays the centred dialog.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Sheet slide/drag state (mobile only). `shown` drives the slide-up; `dragY`
  // is the live drag offset from the handle.
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<number | null>(null);

  // Lock body scroll and play the slide-up on open; reset on close.
  useEffect(() => {
    if (!open) { setShown(false); setDragY(0); return; }
    document.body.style.overflow = 'hidden';
    const r = requestAnimationFrame(() => setShown(true));
    return () => { document.body.style.overflow = ''; cancelAnimationFrame(r); };
  }, [open]);

  // Slide the sheet back down before unmounting (mobile); desktop closes at once.
  const dismiss = () => {
    if (isMobile) {
      setDragging(false);
      setDragY(0);
      setShown(false);
      window.setTimeout(onClose, 300);
    } else {
      onClose();
    }
  };

  const onHandleStart = (e: TouchEvent) => { dragStart.current = e.touches[0].clientY; setDragging(true); };
  const onHandleMove = (e: TouchEvent) => {
    if (dragStart.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - dragStart.current));
  };
  const onHandleEnd = () => {
    setDragging(false);
    dragStart.current = null;
    if (dragY > 100) dismiss();
    else setDragY(0);
  };

  if (!open) return null;

  const sheetStyle = isMobile
    ? {
        transform: `translateY(${shown ? `${dragY}px` : '100%'})`,
        transition: dragging ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end lg:items-center lg:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={dismiss} aria-hidden="true" />

      <div
        className="relative z-10 w-full flex flex-col overflow-hidden bg-neutral-900 shadow-xl will-change-transform
                   h-[calc(100dvh-2.75rem)] rounded-t-2xl border-t border-neutral-800
                   lg:h-auto lg:max-h-[85vh] lg:max-w-2xl lg:rounded-lg lg:border lg:border-gray-700"
        style={sheetStyle}
      >
        {/* Drag handle — mobile only; drag it down to dismiss. */}
        <div
          className="lg:hidden shrink-0 flex items-center justify-center pt-3 pb-2 touch-none cursor-grab active:cursor-grabbing"
          onTouchStart={onHandleStart}
          onTouchMove={onHandleMove}
          onTouchEnd={onHandleEnd}
        >
          <span className="h-1.5 w-10 rounded-full bg-neutral-600" aria-hidden="true" />
        </div>

        {/* Scroll area — one continuous scroll on mobile (hero, tabs and content
            move together); at lg+ only the body scrolls under a fixed hero + tabs. */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col">
          {model ? (
            <>
              {/* Hero — sized to the tallest image (capped so a tall portrait
                  can't push the tabs off-screen); fixed frame for the fallback. */}
              {model.images.length > 0 ? (
                <ImageCarousel
                  images={model.images}
                  alt={model.name}
                  dots
                  autoHeight
                  className="w-full shrink-0 bg-neutral-950 max-h-[55vh]"
                />
              ) : (
                <div className="h-56 shrink-0 relative overflow-hidden bg-neutral-950 flex items-center justify-center">
                  {iconUrl ? (
                    <>
                      <img src={iconUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-40" />
                      <img src={iconUrl} alt="" className="relative w-24 h-24 rounded-lg object-cover shadow-lg" />
                    </>
                  ) : (
                    <span className="relative font-heading text-white text-lg text-center px-6">{model.name}</span>
                  )}
                </div>
              )}

              {/* Name + game */}
              <div className="px-5 pt-4 flex flex-col gap-0.5 shrink-0">
                <h2 className="font-heading text-xl text-white leading-7">{model.name}</h2>
                {model.game && (
                  <div className="flex items-center gap-1.5">
                    {iconUrl && <img src={iconUrl} alt="" className="w-4 h-4 rounded object-cover" />}
                    <span className="font-body text-sm text-neutral-400">{model.game.name}</span>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="px-5 pt-3 shrink-0">
                <TabControl tab={tab} onChange={setTab} />
              </div>

              {/* Body */}
              <div className="px-5 py-4 lg:overflow-y-auto lg:flex-1 lg:min-h-0">
                {tab === 'details'  && <DetailsTab  model={model} />}
                {tab === 'painting' && <PaintingTab model={model} save={save} />}
                {tab === 'lore'     && <LoreTab     model={model} save={save} />}
              </div>
            </>
          ) : (
            <div className="p-10 text-center font-body text-sm text-neutral-400">Loading…</div>
          )}
        </div>
      </div>
    </div>
  );
}
