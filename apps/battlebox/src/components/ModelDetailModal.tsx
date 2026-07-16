import { useEffect, useState } from 'react';
import { Sheet, Lightbox, Select, Badge, InfoCircle, FileText, AddCircle } from '@battleplans/ui';
import type { BadgeColor } from '@battleplans/ui';
import { GAME_ICONS } from './gameIcons';
import { BoxItem } from './BoxItem';
import { ImageCarousel } from './ImageCarousel';
import { AddPaintRecipeModal } from './AddPaintRecipeModal';
import { useModelDetail, updateModel, removeModelPaint, removeModelRecipe } from '../hooks/useCollection';
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

const RemoveIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

function PaintRow({ paint, onRemove }: { paint: PaintRef; onRemove?: () => void }) {
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
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${paint.name}`} className="mt-0.5 shrink-0 text-neutral-500 hover:text-red-400 transition-colors">
          <RemoveIcon />
        </button>
      )}
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

function DetailsTab({ model, onOpenBox }: { model: ModelDetail; onOpenBox?: (boxId: string) => void }) {
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
          {model.includedIn.map(b => (
            <BoxItem key={b.id} box={b} onClick={onOpenBox ? () => onOpenBox(b.id) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function PaintingTab({ model, save, onAdd, onRemovePaint, onRemoveRecipe }: {
  model: ModelDetail;
  save: (p: { status?: ModelStatus; painting_notes?: string | null }) => void;
  onAdd: (kind: 'paint' | 'recipe') => void;
  onRemovePaint: (hobbyItemId: number) => void;
  onRemoveRecipe: (recipeId: string) => void;
}) {
  const hasPaints = model.recipes.length > 0 || model.directPaints.length > 0;
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
        {!hasPaints ? (
          <p className="font-body text-sm text-neutral-500 py-2">No paints recorded yet.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg divide-y divide-neutral-800">
            {model.recipes.map((r: ModelRecipeGroup, i) => (
              <RecipeGroup key={r.id || `r${i}`} recipe={r} onRemove={r.id ? () => onRemoveRecipe(r.id) : undefined} />
            ))}
            {model.directPaints.map(p => (
              <PaintRow key={`p${p.hobbyItemId}`} paint={p} onRemove={() => onRemovePaint(p.hobbyItemId)} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-6 pt-1">
          <button type="button" onClick={() => onAdd('recipe')} className="flex items-center gap-1.5 font-body text-sm font-medium text-primary-500 hover:text-primary-400 transition-colors">
            <AddCircle className="w-4 h-4" /> Add Recipe
          </button>
          <button type="button" onClick={() => onAdd('paint')} className="flex items-center gap-1.5 font-body text-sm font-medium text-primary-500 hover:text-primary-400 transition-colors">
            <AddCircle className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>
    </div>
  );
}

function RecipeGroup({ recipe, onRemove }: { recipe: ModelRecipeGroup; onRemove?: () => void }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <PaintRollerIcon className="w-4 h-4 text-primary-400 shrink-0" />
        <span className="font-heading text-sm text-white flex-1 min-w-0 truncate">{recipe.name}</span>
        <Badge color="primary">Recipe</Badge>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${recipe.name}`} className="shrink-0 text-neutral-500 hover:text-red-400 transition-colors">
            <RemoveIcon />
          </button>
        )}
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

export function ModelDetailModal({ modelId, onClose, onChanged, onOpenBox }: {
  modelId: string | null;
  onClose: () => void;
  onChanged?: () => void;
  /** Open the collection modal for one of this model's "Included in" boxes. */
  onOpenBox?: (boxId: string) => void;
}) {
  const { model, refetch } = useModelDetail(modelId);
  const [tab, setTab] = useState<Tab>('details');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [addKind, setAddKind] = useState<'paint' | 'recipe' | null>(null);

  // Open on Details (lightbox + add modal closed) each time a model is opened.
  useEffect(() => { if (modelId) { setTab('details'); setLightbox(null); setAddKind(null); } }, [modelId]);

  const save = async (patch: { status?: ModelStatus; painting_notes?: string | null; lore_name?: string | null; lore_description?: string | null }) => {
    if (!modelId) return;
    await updateModel(modelId, patch);
    refetch();
    onChanged?.();
  };

  const refresh = () => { refetch(); onChanged?.(); };
  const removePaint = async (hobbyItemId: number) => { if (modelId) { await removeModelPaint(modelId, hobbyItemId); refresh(); } };
  const removeRecipe = async (recipeId: string) => { if (modelId) { await removeModelRecipe(modelId, recipeId); refresh(); } };

  const iconUrl = model?.game?.slug ? GAME_ICONS[model.game.slug] ?? null : null;

  return (
    <Sheet open={modelId !== null} onClose={onClose} className="max-w-2xl">
      {model ? (
        <>
          {/* Hero — sized to the tallest image (capped so a tall portrait can't
              push the tabs off-screen); fixed frame for the fallback. */}
          {model.images.length > 0 ? (
            <ImageCarousel
              images={model.images}
              alt={model.name}
              dots
              autoHeight
              onImageClick={setLightbox}
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

          {/* Body — the desktop scroll region (mobile scrolls with the sheet). */}
          <div className="px-5 py-4 lg:overflow-y-auto lg:flex-1 lg:min-h-0">
            {tab === 'details'  && <DetailsTab  model={model} onOpenBox={onOpenBox} />}
            {tab === 'painting' && <PaintingTab model={model} save={save} onAdd={setAddKind} onRemovePaint={removePaint} onRemoveRecipe={removeRecipe} />}
            {tab === 'lore'     && <LoreTab     model={model} save={save} />}
          </div>

          <Lightbox
            open={lightbox !== null}
            images={model.images}
            startIndex={lightbox ?? 0}
            onClose={() => setLightbox(null)}
            alt={model.name}
          />

          <AddPaintRecipeModal
            open={addKind !== null}
            kind={addKind ?? 'paint'}
            modelId={modelId}
            onClose={() => setAddKind(null)}
            onAdded={refresh}
          />
        </>
      ) : (
        <div className="p-10 text-center font-body text-sm text-neutral-400">Loading…</div>
      )}
    </Sheet>
  );
}
