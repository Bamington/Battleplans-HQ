/**
 * SharedItemPage.tsx — the public page behind a share link
 * (/s/:handle/:token, or the original /s/:token — only the code is looked up).
 *
 * Open to anyone, signed in or not, and strictly read-only. Everything comes
 * from get_shared_item(token): the shared model / collection / recipe and
 * everything inside it (a collection's models, a model's recipes) — purchase
 * dates are never included. A shared collection's models open to their own
 * read-only view right here.
 *
 * Built from the app's own read-only pieces (the model modal's tabs, paint
 * rows and recipe groups; the photo carousel; the desk progress bar) so a
 * shared item looks like it does in the app, minus every edit control.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase, Lightbox, Badge, Button, avatarUrl } from '@battleplans/ui';
import { ImageCarousel } from '../components/ImageCarousel';
import { ModelItem } from '../components/ModelItem';
import { DeskProgress } from '../components/DeskItem';
import { GAME_ICONS } from '../components/gameIcons';
import {
  TabControl, PaintRow, RecipeGroup, Label, PAINT_FRAME, shortDate,
} from '../components/ModelDetailModal';
import type { Tab } from '../components/ModelDetailModal';
import { modelCarouselImages, modelImageUrl } from '../hooks/useCollection';
import type { CollectionModel, ModelRecipeGroup, ModelStatus, PaintRef } from '../hooks/useCollection';
import { getSharedItem, sharePath } from '../lib/sharing';
import type { SharedPayload, SharedModel, SharedBox, SharedRecipe, SharedPaint, SharedImage } from '../lib/sharing';

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
const modelCard = (m: SharedModel): CollectionModel => ({
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

// ── Shared pieces ────────────────────────────────────────────────────────────

/** The big photo at the top — a carousel, or the game icon / name fallback. */
function Hero({ images, name, gameSlug, onOpen }: { images: string[]; name: string; gameSlug?: string | null; onOpen: (i: number) => void }) {
  const icon = gameSlug ? GAME_ICONS[gameSlug] ?? null : null;
  if (images.length) {
    return <ImageCarousel images={images} alt={name} dots autoHeight onImageClick={onOpen} className="w-full bg-neutral-950 max-h-[60vh] rounded-t-xl overflow-hidden" />;
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
function usePhotoViewer() {
  const [view, setView] = useState<{ images: string[]; index: number; alt: string } | null>(null);
  const viewer = (
    <Lightbox open={view !== null} images={view?.images ?? []} startIndex={view?.index ?? 0}
      onClose={() => setView(null)} alt={view?.alt ?? ''} />
  );
  return { open: (images: string[], index: number, alt: string) => setView({ images, index, alt }), viewer };
}

// ── Model ────────────────────────────────────────────────────────────────────

function SharedModelView({ model, openPhotos }: { model: SharedModel; openPhotos: (images: string[], i: number, alt: string) => void }) {
  const [tab, setTab] = useState<Tab>('details');
  const images = modelCarouselImages(model.images, model.image_path);
  const progress = progressImages(model.images);
  const recipes = model.recipes.filter(Boolean).map(recipeGroup);
  const paints = model.direct_paints.map(paintRef);
  const deskStatus = model.on_desk && model.status !== 'Painted';

  return (
    <div className="flex flex-col">
      <Hero images={images} name={model.name} gameSlug={model.game?.slug} onOpen={i => openPhotos(images, i, model.name)} />
      <div className="px-5 pt-4"><Title name={model.name} game={model.game} kindLabel="Model" /></div>
      <div className="px-5 pt-3"><TabControl tab={tab} onChange={setTab} /></div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {tab === 'details' && (
          <>
            <div className={`${PAINT_FRAME} flex flex-col divide-y divide-neutral-800`}>
              <Row>{model.count} {model.count === 1 ? 'Model' : 'Models'}</Row>
              <Row><Badge color={model.status === 'Painted' ? 'success' : 'gray'}>{STATUS_LABEL[model.status] ?? model.status}</Badge></Row>
              {model.started_painting_date && <Row>Started painting {shortDate(model.started_painting_date)}</Row>}
              {model.painted_date && <Row>Painted {shortDate(model.painted_date)}</Row>}
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

function SharedBoxView({ box, onOpenModel, openPhotos }: {
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
            {box.models.map(m => <ModelItem key={m.id} model={modelCard(m)} onClick={() => onOpenModel(m)} />)}
          </div>
        ) : box.includes_string && (
          <p className="font-body text-sm text-neutral-200">{box.includes_string}</p>
        )}
      </div>
    </div>
  );
}

// ── Recipe ───────────────────────────────────────────────────────────────────

function SharedRecipeView({ recipe, openPhotos }: { recipe: SharedRecipe; openPhotos: (images: string[], i: number, alt: string) => void }) {
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SharedItemPage() {
  // /s/<username>/<code> or the original /s/<code>. Only the code is looked
  // up; the username is for reading, and is corrected below.
  const { token = '', handle: urlHandle } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<SharedPayload | null | undefined>(undefined);
  const [viewerId, setViewerId] = useState<string | null>(null);
  /** A collection's model opened from its list (back returns to the list). */
  const [openModel, setOpenModel] = useState<SharedModel | null>(null);
  const photos = usePhotoViewer();

  useEffect(() => {
    let cancelled = false;
    getSharedItem(token).then(p => { if (!cancelled) setPayload(p); });
    supabase.auth.getSession().then(({ data }) => { if (!cancelled) setViewerId(data.session?.user?.id ?? null); });
    return () => { cancelled = true; };
  }, [token]);

  const title = payload?.item.name;
  useEffect(() => { document.title = title ? `${title} — BattleBench` : 'BattleBench'; }, [title]);
  useEffect(() => { window.scrollTo(0, 0); }, [openModel]);

  // Show the owner's CURRENT username in the address: upgrades an old
  // /s/<code> link, and fixes one made before a username change.
  const ownerHandle = payload?.owner?.handle ?? null;
  useEffect(() => {
    if (!ownerHandle || ownerHandle === urlHandle) return;
    navigate(sharePath(token, ownerHandle), { replace: true });
  }, [ownerHandle, urlHandle, token, navigate]);

  const owner = payload?.owner;
  const ownerAvatar = useMemo(() => avatarUrl(owner?.avatar_path), [owner?.avatar_path]);
  const isOwner = !!viewerId && viewerId === owner?.id;

  return (
    <div className="min-h-dvh bg-neutral-950 flex flex-col">
      <header className="h-14 px-4 border-b border-neutral-800 flex items-center justify-between">
        <Link to="/" className="font-heading text-white text-base tracking-wide">BattleBench</Link>
        <Link to={viewerId ? '/app' : '/login'} className="font-body text-sm text-primary-400 hover:text-primary-300">
          {viewerId ? 'Open BattleBench' : 'Sign in'}
        </Link>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
        {payload === undefined ? (
          <p className="py-16 text-center font-body text-sm text-neutral-400">Loading…</p>
        ) : payload === null ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <h1 className="font-heading text-2xl text-white">This link isn't shared</h1>
            <p className="font-body text-sm text-neutral-400 max-w-sm">
              It may have been turned off by its owner, or the link is incomplete.
            </p>
          </div>
        ) : (
          <>
            {owner && (
              <div className="flex items-center gap-2.5">
                {ownerAvatar
                  ? <img src={ownerAvatar} alt="" className="w-8 h-8 rounded-full object-cover border border-neutral-700" />
                  : <span className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700" aria-hidden="true" />}
                <span className="font-body text-sm text-neutral-300">
                  Shared by <span className="text-white font-medium">{owner.handle ? `@${owner.handle}` : 'a BattleBench painter'}</span>
                </span>
                {isOwner && (
                  <Link to="/app" className="ml-auto"><Button size="xs" variant="outline" color="primary">This is yours — open in the app</Button></Link>
                )}
              </div>
            )}

            {openModel && (
              <button type="button" onClick={() => setOpenModel(null)}
                className="self-start font-body text-sm text-primary-400 hover:text-primary-300">
                ← Back to {payload.kind === 'box' ? payload.item.name : 'collection'}
              </button>
            )}

            <article className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl overflow-hidden">
              {openModel ? (
                <SharedModelView key={openModel.id} model={openModel} openPhotos={photos.open} />
              ) : payload.kind === 'model' ? (
                <SharedModelView model={payload.item} openPhotos={photos.open} />
              ) : payload.kind === 'box' ? (
                <SharedBoxView box={payload.item} onOpenModel={setOpenModel} openPhotos={photos.open} />
              ) : (
                <SharedRecipeView recipe={payload.item} openPhotos={photos.open} />
              )}
            </article>

            {!viewerId && (
              <p className="text-center font-body text-sm text-neutral-400">
                Track your own collection, paint recipes and projects —{' '}
                <Link to="/login" className="text-primary-400 hover:text-primary-300">try BattleBench</Link>.
              </p>
            )}
          </>
        )}
      </main>
      {photos.viewer}
    </div>
  );
}
