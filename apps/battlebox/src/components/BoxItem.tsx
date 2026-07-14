import { Badge, UserRounded, Box } from '@battleplans/ui';
import { GAME_ICONS } from './gameIcons';
import { CollectionThumb, CardHero, clickableProps } from './ModelItem';
import type { CollectionBox } from '../hooks/useCollection';

const cardHover = ' cursor-pointer hover:border-neutral-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500';

// ── Shared content body ───────────────────────────────────────────────────────

export function BoxCardBody({ box }: { box: CollectionBox }) {
  const subtitle = box.game?.name ?? box.includesString ?? null;
  return (
    <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
      <div className="flex flex-col min-w-0">
        <span className="font-heading text-lg text-white leading-6 truncate">{box.name}</span>
        {subtitle && (
          <span className="font-body text-sm font-bold text-neutral-300 leading-5 opacity-50 truncate">
            {subtitle}
          </span>
        )}
      </div>
      <div className="flex gap-1 items-center flex-wrap">
        <Badge color="purple" icon={<UserRounded className="w-full h-full" />}>
          {box.modelCount} {box.modelCount === 1 ? 'Model' : 'Models'}
        </Badge>
        <Badge color="gray" icon={<Box className="w-full h-full" />}>
          {box.type}
        </Badge>
      </div>
    </div>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────

export function BoxItem({ box, onClick }: { box: CollectionBox; onClick?: () => void }) {
  const iconUrl = box.game?.slug ? GAME_ICONS[box.game.slug] ?? null : null;
  return (
    <div
      {...clickableProps(onClick)}
      className={`bg-neutral-800 border border-neutral-700 rounded-lg p-px shadow-md overflow-hidden flex items-stretch gap-1.5${onClick ? cardHover : ''}`}
    >
      <CollectionThumb imageUrl={box.imageUrl} iconUrl={iconUrl} name={box.name} />
      <div className="flex-1 min-w-0 flex pr-3 py-3">
        <BoxCardBody box={box} />
      </div>
    </div>
  );
}

// ── Gallery card ──────────────────────────────────────────────────────────────

export function BoxGridItem({ box, onClick }: { box: CollectionBox; onClick?: () => void }) {
  const iconUrl = box.game?.slug ? GAME_ICONS[box.game.slug] ?? null : null;
  return (
    <div
      {...clickableProps(onClick)}
      className={`bg-neutral-800 border border-neutral-700 rounded-lg flex flex-col gap-1.5 shadow-md overflow-hidden w-full max-w-[384px]${onClick ? cardHover : ''}`}
    >
      <CardHero imageUrl={box.imageUrl} iconUrl={iconUrl} name={box.name} />
      <div className="flex gap-1.5 items-start p-3">
        <BoxCardBody box={box} />
      </div>
    </div>
  );
}
