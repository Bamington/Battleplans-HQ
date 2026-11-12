/**
 * bench/SharedViews.tsx — BattleBench models, collections and recipes,
 * read-only. Used by share links, friends' credited models, and the Painting
 * Bench and Favourites on a profile — in any app, which is why they live here.
 *
 * Everything takes the "shared" JSON shape built by shared_model_json /
 * shared_box_json / shared_recipe_json in the database (never purchase dates),
 * and is built from the same pieces as BattleBench's own model modal (tabs,
 * paint rows, recipe groups, the photo carousel, the desk progress bar), so a
 * shared item looks like it does in the app, minus every edit control.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Lightbox from '../components/Lightbox';
import Badge from '../components/Badge';
import { profilePath } from '../components/FriendProfileModal';
import { ImageCarousel } from './ImageCarousel';
import { ModelItem } from './ModelItem';
import { GAME_ICONS } from '../lib/gameArt';
import { TabControl, PaintRow, RecipeGroup, Label, PAINT_FRAME, shortDate, DeskProgress, type Tab } from './modelParts';
import { modelCarouselImages, modelImageUrl } from './types';
import type { CollectionBox, CollectionModel, ModelRecipeGroup, ModelStatus, PaintRef } from './types';

// ── The shared JSON shapes ───────────────────────────────────────────────────

export interface SharedPaint { name: string; brand: string; type: string; swatch: string | null; note: string | null }
export interface SharedImage {
  image_path: string | null; image_url?: string | null;
  is_primary: boolean; display_order: number; is_progress?: boolean; created_at?: string | null;
}
export interface SharedRecipe { id: string; name: string; description: string | null; paints: SharedPaint[]; images: SharedImage[] }
export interface SharedModel {
  id: string; name: string; status: string; count: number;
  painted_date: string | null; started_painting_date: string | null; on_desk: boolean;
  painting_notes: string | null; lore_name: string | null; lore_description: string | null;
  image_path: string | null; game: { name: string; slug: string } | null;
  images: SharedImage[]; recipes: SharedRecipe[]; direct_paints: SharedPaint[];
  included_in: { name: string; type: string }[];
  /** Who painted it (absent from links made before painters existed). */
  painted_by_me?: boolean;
  painter_name?: string | null;
  painted_for_name?: string | null;
  /** The credited person's @username, when they have an account. */
  painter_handle?: string | null;
  painted_for_handle?: string | null;
}
export interface SharedBox {
  id: string; name: string; type: string; includes_string: string | null;
  game: { name: string; slug: string } | null; images: SharedImage[]; models: SharedModel[];
}

const STATUS_LABEL: Record<string, string> = {
  'None': 'Unpainted', 'Assembled': 'Assembled', 'Primed': 'Primed',
  'Partially Painted': 'Partially Painted', 'Painted': 'Painted',
};

// ── Mapping the shared bundle onto the app's display shapes ──────────────────

const paintRef = (p: SharedPaint, i: number): PaintRef => ({
  hobbyItemId: i, name: p.name, brand: p.brand, type: p.type, swatch: p.swatch, note: p.note, ownerId: null,
});

const recipeGroup = (r: SharedRecipe): ModelRecipeGroup => ({
  id: r.id, name: r.name, description: r.description,
  paints: r.paints.map(paintRef),
  images: modelCarouselImages(r.images, null),
});

/** A shared model as a ModelItem card (for a collection's list). */
export const sharedModelCard = (m: SharedModel): CollectionModel => ({
  id: m.id, name: m.name, status: m.status as ModelStatus, count: m.count,
  images: modelCarouselImages(m.images, m.image_path),
  game: m.game, boxName: null, onDesk: m.on_desk, startedPaintingDate: m.started_painting_date,
});

const progressImages = (images: SharedImage[]) => images
  .filter(i => i.is_progress)
  .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  .map(i => modelImageUrl(i.image_path))
  .filter((u): u is string => !!u);

/** A collection's photos: its own, then one per member model — as in the app. */
function boxImages(b: SharedBox): string[] {
  const own = b.images
    .slice().sort((x, y) => x.display_order - y.display_order)
    .map(i => (i.image_path ? modelImageUrl(i.image_path) : i.image_url ?? null))
    .filter((u): u is string => !!u);
  const members = b.models.map(m => modelCarouselImages(m.images, m.image_path)[0]).filter((u): u is string => !!u);
  return [...new Set([...own, ...members])];
}

/** A shared collection as a BoxItem card (for a profile's Favourites). */
export const sharedBoxCard = (b: SharedBox): CollectionBox => {
  const statuses = b.models.map(m => m.status);
  return {
    id: b.id, name: b.name, type: b.type === 'Box' ? 'Box' : 'Collection', includesString: b.includes_string,
    game: b.game, modelCount: b.models.length,
    allPainted:   statuses.length > 0 && statuses.every(s => s === 'Painted'),
    allUnpainted: statuses.length > 0 && statuses.every(s => s === 'None'),
    anyProgress:  statuses.some(s => s !== 'None'),
    images: boxImages(b),
  };
};

// ── Shared pieces ────────────────────────────────────────────────────────────

/** The big photo at the top — a carousel, or the game icon / name fallback. */
function Hero({ images, name, gameSlug, onOpen }: { images: string[]; name: string; gameSlug?: string | null; onOpen: (i: number) => void }) {
  const icon = gameSlug ? GAME_ICONS[gameSlug] ?? null : null;
  if (images.length) {
    return <ImageCarousel images={images} alt={name} dots autoHeight swipe onImageClick={onOpen} className="w-full bg-neutral-950 max-h-[60vh] rounded-t-xl overflow-hidden" />;
  }
  return (
    <div className="h-48 relative overflow-hidden bg-neutral-950 flex items-center justify-center rounded-t-xl">
      {icon && <img src={icon} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-40" />}
      {icon
        ? <img src={icon} alt="" className="relative w-24 h-24 rounded-lg object-cover shadow-lg" />
        : <span className="relative font-heading text-white text-lg text-center px-6">{name}</span>}
    </div>
  );
}

function Title({ name, game, kindLabel }: { name: string; game: { name: string; slug: string } | null; kindLabel: string }) {
  const icon = game?.slug ? GAME_ICONS[game.slug] ?? null : null;
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="font-body text-xs uppercase tracking-wide text-primary-400">{kindLabel}</span>
      <h1 className="font-heading text-2xl text-white leading-8">{name}</h1>
      {game && (
        <div className="flex items-center gap-1.5">
          {icon && <img src={icon} alt="" className="w-4 h-4 rounded object-cover" />}
          <span className="font-body text-sm text-neutral-400">{game.name}</span>
        </div>
      )}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 px-3 py-2.5 font-body text-sm text-white">{children}</div>;
}

function ThumbStrip({ images, label, onOpen }: { images: string[]; label: string; onOpen: (i: number) => void }) {
  if (!images.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {images.map((url, i) => (
          <button key={url} type="button" onClick={() => onOpen(i)} aria-label={`View ${label.toLowerCase()} ${i + 1}`}
            className="shrink-0 w-20 h-20 rounded-md overflow-hidden border border-neutral-700 hover:border-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
            <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Opens a set of photos full screen; one per page is enough. */
export function usePhotoViewer() {
  const [view, setView] = useState<{ images: string[]; index: number; alt: string } | null>(null);
  const viewer = (
    <Lightbox open={view !== null} images={view?.images ?? []} startIndex={view?.index ?? 0}
      onClose={() => setView(null)} alt={view?.alt ?? ''} />
  );
  return { open: (images: string[], index: number, alt: string) => setView({ images, index, alt }), viewer };
}

// ── Model ────────────────────────────────────────────────────────────────────

/** A link to someone's full profile page — it works signed out, unlike the modal. */
export const ProfileLink = ({ handle }: { handle: string }) => (
  <Link to={profilePath(handle)} className="text-primary-400 hover:text-primary-300 hover:underline">@{handle}</Link>
);

/** "Painted by Sam" / "Painted for Sam" from a shared model — the owner's
 *  words, plus the person's @username when they have an account. */
function sharedPainterLine(m: SharedModel): React.ReactNode {
  const withHandle = (text: string, handle?: string | null) =>
    handle ? <>{text} (<ProfileLink handle={handle} />)</> : text;
  if (m.painted_by_me === false) {
    return m.painter_name ? withHandle(`Painted by ${m.painter_name}`, m.painter_handle) : 'Painted by someone else';
  }
  return m.painted_for_name ? withHandle(`Painted for ${m.painted_for_name}`, m.painted_for_handle) : null;
}

/** A shared model, read-only. Also the friend's view of a model credited to
 *  them, which passes its own `painterLine` (worded from their side). */
export function SharedModelView({ model, openPhotos, painterLine }: {
  model: SharedModel;
  openPhotos: (images: string[], i: number, alt: string) => void;
  painterLine?: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>('details');
  const credit = painterLine !== undefined ? painterLine : sharedPainterLine(model);
  const images = modelCarouselImages(model.images, model.image_path);
  const progress = progressImages(model.images);
  const recipes = model.recipes.filter(Boolean).map(recipeGroup);
  const paints = model.direct_paints.map(paintRef);
  const deskStatus = model.on_desk && model.status !== 'Painted';

  // Only tabs with something in them. Details always has the model count and
  // status; with nothing else to show, the picker itself goes.
  const hasPainting = !!model.painting_notes || paints.length > 0 || recipes.length > 0 || progress.length > 0;
  const hasLore = !!model.lore_name || !!model.lore_description;
  const tabs: Tab[] = ['details', ...(hasPainting ? ['painting' as const] : []), ...(hasLore ? ['lore' as const] : [])];

  return (
    <div className="flex flex-col">
      <Hero images={images} name={model.name} gameSlug={model.game?.slug} onOpen={i => openPhotos(images, i, model.name)} />
      <div className="px-5 pt-4"><Title name={model.name} game={model.game} kindLabel="Model" /></div>
      {tabs.length > 1 && <div className="px-5 pt-3"><TabControl tab={tab} onChange={setTab} show={tabs} /></div>}

      <div className="px-5 py-4 flex flex-col gap-4">
        {tab === 'details' && (
          <>
            <div className={`${PAINT_FRAME} flex flex-col divide-y divide-neutral-800`}>
              <Row>{model.count} {model.count === 1 ? 'Model' : 'Models'}</Row>
              <Row><Badge color={model.status === 'Painted' ? 'success' : 'gray'}>{STATUS_LABEL[model.status] ?? model.status}</Badge></Row>
              {model.started_painting_date && <Row>Started painting {shortDate(model.started_painting_date)}</Row>}
              {model.painted_date && <Row>Painted {shortDate(model.painted_date)}</Row>}
              {credit && <Row>{credit}</Row>}
            </div>
            {deskStatus && (
              <div className={`${PAINT_FRAME} px-3 py-3 flex flex-col gap-1.5`}>
                <span className="font-body text-xs text-neutral-400">On the Painting Desk</span>
                <DeskProgress status={model.status as ModelStatus} />
              </div>
            )}
            {model.included_in.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="font-body text-sm text-neutral-400">Included in:</span>
                <div className="flex flex-wrap gap-1.5">
                  {model.included_in.map(b => <Badge key={b.name} color="gray">{b.name}</Badge>)}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'painting' && (
          <>
            {model.painting_notes && (
              <div className="flex flex-col gap-1.5">
                <Label>Painting Notes</Label>
                <p className="font-body text-sm text-neutral-200 whitespace-pre-wrap">{model.painting_notes}</p>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>Paints Used</Label>
              {!paints.length && !recipes.length ? (
                <p className="font-body text-sm text-neutral-500 py-2">No paints recorded.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {paints.length > 0 && (
                    <div className={`${PAINT_FRAME} divide-y divide-neutral-800`}>
                      {paints.map(p => <PaintRow key={p.hobbyItemId} paint={p} />)}
                    </div>
                  )}
                  {recipes.map(r => (
                    <div key={r.id} className={PAINT_FRAME}>
                      <RecipeGroup recipe={r} onOpenPhoto={i => openPhotos(r.images, i, r.name)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <ThumbStrip images={progress} label="Progress Photos" onOpen={i => openPhotos(progress, i, `${model.name} — progress`)} />
          </>
        )}

        {tab === 'lore' && (
          !model.lore_name && !model.lore_description ? (
            <p className="font-body text-sm text-neutral-500 py-2">No lore written yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {model.lore_name && <h2 className="font-heading text-lg text-white">{model.lore_name}</h2>}
              {model.lore_description && <p className="font-body text-sm text-neutral-200 whitespace-pre-wrap">{model.lore_description}</p>}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Collection ───────────────────────────────────────────────────────────────

export function SharedBoxView({ box, onOpenModel, openPhotos }: {
  box: SharedBox;
  onOpenModel: (m: SharedModel) => void;
  openPhotos: (images: string[], i: number, alt: string) => void;
}) {
  const images = boxImages(box);
  return (
    <div className="flex flex-col">
      <Hero images={images} name={box.name} gameSlug={box.game?.slug} onOpen={i => openPhotos(images, i, box.name)} />
      <div className="px-5 pt-4"><Title name={box.name} game={box.game} kindLabel={box.type === 'Box' ? 'Box' : 'Collection'} /></div>
      <div className="px-5 py-4 flex flex-col gap-3">
        <div className={`${PAINT_FRAME} flex flex-col divide-y divide-neutral-800`}>
          <Row>{box.models.length} {box.models.length === 1 ? 'Model' : 'Models'}</Row>
        </div>
        {box.models.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="font-body text-sm text-neutral-400">Includes:</span>
            {box.models.map(m => <ModelItem key={m.id} model={sharedModelCard(m)} onClick={() => onOpenModel(m)} />)}
          </div>
        ) : box.includes_string && (
          <p className="font-body text-sm text-neutral-200">{box.includes_string}</p>
        )}
      </div>
    </div>
  );
}

// ── Recipe ───────────────────────────────────────────────────────────────────

export function SharedRecipeView({ recipe, openPhotos }: { recipe: SharedRecipe; openPhotos: (images: string[], i: number, alt: string) => void }) {
  const images = modelCarouselImages(recipe.images, null);
  return (
    <div className="flex flex-col">
      <Hero images={images} name={recipe.name} onOpen={i => openPhotos(images, i, recipe.name)} />
      <div className="px-5 pt-4"><Title name={recipe.name} game={null} kindLabel="Paint Recipe" /></div>
      <div className="px-5 py-4 flex flex-col gap-4">
        {recipe.description && <p className="font-body text-sm text-neutral-200 whitespace-pre-wrap">{recipe.description}</p>}
        <div className="flex flex-col gap-1.5">
          <Label>Paints</Label>
          {recipe.paints.length ? (
            <div className={`${PAINT_FRAME} divide-y divide-neutral-800`}>
              {recipe.paints.map((p, i) => <PaintRow key={i} paint={paintRef(p, i)} />)}
            </div>
          ) : <p className="font-body text-sm text-neutral-500 py-2">No paints in this recipe yet.</p>}
        </div>
      </div>
    </div>
  );
}

