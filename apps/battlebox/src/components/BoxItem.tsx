import { Badge, UserRounded, Box } from '@battleplans/ui';
import { GAME_ICONS } from './gameIcons';
import { CollectionThumb } from './ModelItem';
import type { CollectionBox } from '../hooks/useCollection';

export function BoxItem({ box }: { box: CollectionBox }) {
  const subtitle = box.game?.name ?? box.includesString ?? null;
  const iconUrl = box.game?.slug ? GAME_ICONS[box.game.slug] ?? null : null;

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-px shadow-md overflow-hidden flex items-stretch gap-1.5">

      <CollectionThumb imageUrl={null} iconUrl={iconUrl} name={box.name} />

      <div className="flex-1 min-w-0 flex flex-col justify-between pr-3 py-3 gap-2">
        <div className="flex flex-col min-w-0">
          <span className="font-heading text-lg text-white leading-6 truncate">{box.name}</span>
          {subtitle && (
            <span className="font-body text-sm font-bold text-neutral-300 leading-5 opacity-50 truncate">
              {subtitle}
            </span>
          )}
        </div>

        <div className="flex gap-1 items-center px-1.5">
          <Badge color="purple" icon={<UserRounded className="w-full h-full" />}>
            {box.modelCount} {box.modelCount === 1 ? 'Model' : 'Models'}
          </Badge>
          <Badge color="gray" icon={<Box className="w-full h-full" />}>
            {box.type}
          </Badge>
        </div>
      </div>

    </div>
  );
}
