/**
 * RecipeItem.tsx — A paint recipe in the Recipes column: list row and gallery
 * card, matching ModelItem / BoxItem. Shows the recipe's photos (or its name on
 * a dark tile), its paints as a row of swatches, and how many models use it.
 */

import { Badge, UserRounded } from '@battleplans/ui';
import { CollectionThumb, CardHero, clickableProps } from './ModelItem';
import type { RecipeSummary } from '../hooks/useCollection';

const HEX = /^#[0-9a-fA-F]{6}$/;
/** Swatches shown before the rest collapse into "+N". */
const MAX_SWATCHES = 8;

const cardHover = ' cursor-pointer hover:border-neutral-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

const PaletteIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <path d="M8 2C4.7 2 2 4.3 2 7.3c0 2 1.7 3 3 3h1a1.3 1.3 0 0 1 1.3 1.4c0 .3-.2.6-.2 1 0 .7.7 1.3 1.4 1.3 3.3 0 5.9-2.6 5.9-6C14.4 4.3 11.6 2 8 2Z"
      stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    <circle cx="5" cy="6.5" r=".8" fill="currentColor" />
    <circle cx="8" cy="4.8" r=".8" fill="currentColor" />
    <circle cx="11" cy="6.5" r=".8" fill="currentColor" />
  </svg>
);

/** The recipe's paints as overlapping colour dots, in recipe order. */
export function RecipeSwatches({ recipe }: { recipe: RecipeSummary }) {
  if (recipe.paints.length === 0) return null;
  const shown = recipe.paints.slice(0, MAX_SWATCHES);
  const extra = recipe.paints.length - shown.length;
  return (
    <div className="flex items-center" aria-label={recipe.paints.map(p => p.name).join(', ')}>
      {shown.map((p, i) => (
        <span
          key={p.hobbyItemId}
          title={p.name}
          className={`w-4 h-4 rounded-full border border-neutral-900 ring-1 ring-neutral-600 shrink-0 bg-neutral-700${i ? ' -ml-1' : ''}`}
          style={HEX.test(p.swatch ?? '') ? { backgroundColor: p.swatch! } : undefined}
        />
      ))}
      {extra > 0 && <span className="ml-1.5 font-body text-xs text-neutral-400">+{extra}</span>}
    </div>
  );
}

export function RecipeCardBody({ recipe }: { recipe: RecipeSummary }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-heading text-lg text-white leading-6 truncate">{recipe.name}</span>
        {recipe.description && (
          <span className="font-body text-sm text-neutral-400 leading-5 line-clamp-1">{recipe.description}</span>
        )}
        <RecipeSwatches recipe={recipe} />
      </div>
      <div className="flex gap-1 items-center flex-wrap">
        <Badge color="gray" icon={<PaletteIcon />}>
          {recipe.paints.length} {recipe.paints.length === 1 ? 'Paint' : 'Paints'}
        </Badge>
        {recipe.modelCount > 0 && (
          <Badge color="purple" icon={<UserRounded className="w-full h-full" />}>
            {recipe.modelCount} {recipe.modelCount === 1 ? 'Model' : 'Models'}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────

export function RecipeItem({ recipe, onClick }: { recipe: RecipeSummary; onClick?: () => void }) {
  return (
    <div
      {...clickableProps(onClick)}
      className={`bg-neutral-800 border border-neutral-700 rounded-lg p-px shadow-md overflow-hidden flex items-stretch gap-1.5${onClick ? cardHover : ''}`}
    >
      <CollectionThumb images={recipe.images} iconUrl={null} name={recipe.name} />
      <div className="flex-1 min-w-0 flex pr-3 py-3">
        <RecipeCardBody recipe={recipe} />
      </div>
    </div>
  );
}

// ── Gallery card ──────────────────────────────────────────────────────────────

export function RecipeGridItem({ recipe, onClick }: { recipe: RecipeSummary; onClick?: () => void }) {
  return (
    <div
      {...clickableProps(onClick)}
      className={`bg-neutral-800 border border-neutral-700 rounded-lg flex flex-col gap-1.5 shadow-md overflow-hidden w-full max-w-[384px]${onClick ? cardHover : ''}`}
    >
      <CardHero images={recipe.images} iconUrl={null} name={recipe.name} />
      <div className="flex gap-1.5 items-start p-3">
        <RecipeCardBody recipe={recipe} />
      </div>
    </div>
  );
}
