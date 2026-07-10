import { Badge, UserRounded } from '@battleplans/ui';
import type { BadgeColor } from '@battleplans/ui';
import { GAME_ICONS } from './gameIcons';
import { modelImageUrl } from '../hooks/useCollection';
import type { CollectionModel, ModelStatus } from '../hooks/useCollection';

// ── Icons ─────────────────────────────────────────────────────────────────────

/** Paint-roller glyph for the paint-status badge (Figma "Design Tools / Paint Roller"). */
const PaintRollerIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <rect x="2" y="2.5" width="9" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <path d="M11 4.5h2a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1H7a1 1 0 0 0-1 1V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="4.5" y="10" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

// ── Status → badge presentation ───────────────────────────────────────────────
// 'None' is stored for unpainted models; it reads better as "Unpainted".
const STATUS: Record<ModelStatus, { label: string; color: BadgeColor }> = {
  'Painted':           { label: 'Painted',           color: 'success' },
  'Partially Painted': { label: 'Partially Painted', color: 'warning' },
  'Primed':            { label: 'Primed',            color: 'warning' },
  'Assembled':         { label: 'Assembled',         color: 'gray'    },
  'None':              { label: 'Unpainted',         color: 'gray'    },
};

// ── Thumbnail ─────────────────────────────────────────────────────────────────
// A 108px square that bleeds to the card edges. Prefers the model's own photo,
// falls back to the game icon, then to the model name on a dark tile.

export function CollectionThumb({ imageUrl, iconUrl, name }: {
  imageUrl: string | null;
  iconUrl: string | null;
  name: string;
}) {
  return (
    <div className="w-[108px] h-[108px] shrink-0 self-stretch bg-[#0f131c] flex items-center justify-center overflow-hidden">
      {imageUrl
        ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        : iconUrl
          ? <img src={iconUrl} alt="" className="w-full h-full object-cover" />
          : <span className="font-heading text-white text-sm text-center px-2 leading-tight line-clamp-3">{name}</span>}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

export function ModelItem({ model }: { model: CollectionModel }) {
  const status = STATUS[model.status] ?? STATUS.None;
  const subtitle = model.boxName ?? model.game?.name ?? null;
  const iconUrl = model.game?.slug ? GAME_ICONS[model.game.slug] ?? null : null;

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-px shadow-md overflow-hidden flex items-stretch gap-1.5">

      <CollectionThumb imageUrl={modelImageUrl(model.imagePath)} iconUrl={iconUrl} name={model.name} />

      <div className="flex-1 min-w-0 flex flex-col justify-between pr-3 py-3 gap-2">
        <div className="flex flex-col min-w-0">
          <span className="font-heading text-lg text-white leading-6 truncate">{model.name}</span>
          {subtitle && (
            <span className="font-body text-sm font-bold text-neutral-300 leading-5 opacity-50 truncate">
              {subtitle}
            </span>
          )}
        </div>

        <div className="flex gap-1 items-center px-1.5">
          <Badge color="purple" icon={<UserRounded className="w-full h-full" />}>
            {model.count} {model.count === 1 ? 'Model' : 'Models'}
          </Badge>
          <Badge color={status.color} icon={<PaintRollerIcon />}>
            {status.label}
          </Badge>
        </div>
      </div>

    </div>
  );
}
