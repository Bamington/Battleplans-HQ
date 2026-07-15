import type React from 'react';
import { Badge, UserRounded } from '@battleplans/ui';
import type { BadgeColor } from '@battleplans/ui';
import { GAME_ICONS } from './gameIcons';
import { ImageCarousel } from './ImageCarousel';
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

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Props that make a card behave as a button (list row or gallery card). */
export function clickableProps(onClick?: () => void) {
  if (!onClick) return {};
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
    },
  };
}

/** Interactive-card classes shared by list rows and gallery cards. */
const cardHover = ' cursor-pointer hover:border-neutral-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500';

// ── Thumbnail ─────────────────────────────────────────────────────────────────
// A square that bleeds to the card edges. Auto-rotates through the item's photos
// (a carousel when there's more than one), falls back to the game icon, then to
// the item name on a dark tile.

export function CollectionThumb({ images, iconUrl, name, className = 'w-[108px] h-[108px]', dots = false }: {
  images: string[];
  iconUrl: string | null;
  name: string;
  className?: string;
  dots?: boolean;
}) {
  return (
    <div className={`shrink-0 self-stretch bg-[#0f131c] flex items-center justify-center overflow-hidden ${className}`.trim()}>
      {images.length > 0
        ? <ImageCarousel images={images} alt={name} dots={dots} className="w-full h-full" />
        : iconUrl
          ? <img src={iconUrl} alt="" className="w-full h-full object-cover" />
          : <span className="font-heading text-white text-sm text-center px-2 leading-tight line-clamp-3">{name}</span>}
    </div>
  );
}

/** A 260px hero for a gallery card: an auto-rotating carousel of the item's
 *  photos, or a blurred game-icon backdrop with the crisp icon centred, or the
 *  name on a flat tile. */
function CardHero({ images, iconUrl, name }: { images: string[]; iconUrl: string | null; name: string }) {
  return (
    <div className="h-[260px] w-full shrink-0 relative overflow-hidden bg-neutral-900 flex items-center justify-center">
      {images.length > 0 ? (
        <ImageCarousel images={images} alt={name} dots className="absolute inset-0 w-full h-full" />
      ) : iconUrl ? (
        <>
          <img src={iconUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-40" />
          <img src={iconUrl} alt="" className="relative w-24 h-24 rounded-lg object-cover shadow-lg" />
        </>
      ) : (
        <span className="relative font-heading text-white text-lg text-center px-6">{name}</span>
      )}
    </div>
  );
}

// ── Shared content body ───────────────────────────────────────────────────────
// Name + subtitle + count/status badges, shared by the list row and the
// gallery card's content strip.

export function ModelCardBody({ model }: { model: CollectionModel }) {
  const status   = STATUS[model.status] ?? STATUS.None;
  const subtitle = model.boxName ?? model.game?.name ?? null;
  return (
    <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
      <div className="flex flex-col min-w-0">
        <span className="font-heading text-lg text-white leading-6 truncate">{model.name}</span>
        {subtitle && (
          <span className="font-body text-sm font-bold text-neutral-300 leading-5 opacity-50 truncate">
            {subtitle}
          </span>
        )}
      </div>
      <div className="flex gap-1 items-center flex-wrap">
        <Badge color="purple" icon={<UserRounded className="w-full h-full" />}>
          {model.count} {model.count === 1 ? 'Model' : 'Models'}
        </Badge>
        <Badge color={status.color} icon={<PaintRollerIcon />}>
          {status.label}
        </Badge>
      </div>
    </div>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────

export function ModelItem({ model, onClick }: { model: CollectionModel; onClick?: () => void }) {
  const iconUrl = model.game?.slug ? GAME_ICONS[model.game.slug] ?? null : null;
  return (
    <div
      {...clickableProps(onClick)}
      className={`bg-neutral-800 border border-neutral-700 rounded-lg p-px shadow-md overflow-hidden flex items-stretch gap-1.5${onClick ? cardHover : ''}`}
    >
      <CollectionThumb images={model.images} iconUrl={iconUrl} name={model.name} />
      <div className="flex-1 min-w-0 flex pr-3 py-3">
        <ModelCardBody model={model} />
      </div>
    </div>
  );
}

// ── Gallery card ──────────────────────────────────────────────────────────────

export function ModelGridItem({ model, onClick }: { model: CollectionModel; onClick?: () => void }) {
  const iconUrl = model.game?.slug ? GAME_ICONS[model.game.slug] ?? null : null;
  return (
    <div
      {...clickableProps(onClick)}
      className={`bg-neutral-800 border border-neutral-700 rounded-lg flex flex-col gap-1.5 shadow-md overflow-hidden w-full max-w-[384px]${onClick ? cardHover : ''}`}
    >
      <CardHero images={model.images} iconUrl={iconUrl} name={model.name} />
      <div className="flex gap-1.5 items-start p-3">
        <ModelCardBody model={model} />
      </div>
    </div>
  );
}

export { CardHero };
