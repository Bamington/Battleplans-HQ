import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@battleplans/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModelStatus = 'None' | 'Assembled' | 'Primed' | 'Partially Painted' | 'Painted';

/** Collection-list filter (more options to come). */
export type CollectionFilter = 'all' | 'painted';

export interface CollectionGame {
  name: string;
  slug: string;
}

export interface CollectionModel {
  id: string;
  name: string;
  status: ModelStatus;
  count: number;
  /** The model's photos as URLs (primary first) — auto-rotated in a carousel. */
  images: string[];
  game: CollectionGame | null;
  /** Name of the first box/collection this model belongs to, if any. */
  boxName: string | null;
}

export interface CollectionBox {
  id: string;
  name: string;
  type: 'Box' | 'Collection';
  includesString: string | null;
  game: CollectionGame | null;
  /** How many models are linked to this box. */
  modelCount: number;
  /** True when the collection has models and every one of them is painted. */
  allPainted: boolean;
  /**
   * Carousel images: the box's own cover photos, then one photo per member
   * model, de-duplicated. Mirrors the old app's collection carousel.
   */
  images: string[];
}

// ── Image helper ──────────────────────────────────────────────────────────────

/**
 * Build a public URL for a stored model image. Image locations are kept as
 * bucket object paths ('{user_id}/{file}') rather than full URLs, so the host
 * is resolved here at read time and a future project move needs no data change.
 */
export function modelImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from('model-images').getPublicUrl(path).data.publicUrl;
}

// ── Row shapes returned by the embedded selects ───────────────────────────────

interface ModelImageRow {
  image_path: string | null;
  is_primary: boolean;
  display_order: number;
}

interface ModelRow {
  id: string;
  name: string;
  status: ModelStatus;
  count: number;
  image_path: string | null;
  game: CollectionGame | null;
  model_boxes: { box: { name: string } | null }[] | null;
  model_images: ModelImageRow[] | null;
}

interface BoxImageRow {
  image_path: string | null;
  image_url: string | null;
  is_primary: boolean;
  display_order: number;
}

interface BoxRow {
  id: string;
  name: string;
  type: 'Box' | 'Collection';
  includes_string: string | null;
  game: CollectionGame | null;
  model_boxes: { model: { image_path: string | null; status: ModelStatus } | null }[] | null;
  box_images: BoxImageRow[] | null;
}

const MODEL_SELECT =
  'id, name, status, count, image_path, game:games ( name, slug ), ' +
  'model_boxes ( box:boxes ( name ) ), model_images ( image_path, is_primary, display_order )';
const BOX_SELECT =
  'id, name, type, includes_string, game:games ( name, slug ), ' +
  'model_boxes ( model:models ( image_path, status ) ), ' +
  'box_images ( image_path, image_url, is_primary, display_order )';

/** How many rows are fetched per page as the collection is scrolled. */
const PAGE_SIZE = 24;

/** A model's photos as URLs, primary first then by display order; falls back to
 *  the model's own image_path when it has no model_images rows. */
function modelCarouselImages(rows: ModelImageRow[] | null, fallbackPath: string | null): string[] {
  const urls = (rows ?? [])
    .slice()
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.display_order - b.display_order)
    .map(r => modelImageUrl(r.image_path))
    .filter((u): u is string => !!u);
  if (urls.length) return urls;
  const fb = modelImageUrl(fallbackPath);
  return fb ? [fb] : [];
}

function mapModel(r: ModelRow): CollectionModel {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    count: r.count,
    images: modelCarouselImages(r.model_images, r.image_path),
    game: r.game,
    boxName: r.model_boxes?.find(mb => mb.box)?.box?.name ?? null,
  };
}

/** Resolve one box_image row: a bucket object path, else an external link. */
function boxImageRowUrl(img: BoxImageRow): string | null {
  return img.image_path ? modelImageUrl(img.image_path) : (img.image_url ?? null);
}

/** A box's carousel images: its own cover photos (by display order), then one
 *  photo per member model, de-duplicated. */
function boxCarouselImages(r: BoxRow): string[] {
  const own = (r.box_images ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map(boxImageRowUrl)
    .filter((u): u is string => !!u);
  const members = (r.model_boxes ?? [])
    .map(mb => modelImageUrl(mb.model?.image_path))
    .filter((u): u is string => !!u);
  return [...new Set([...own, ...members])];
}

function mapBox(r: BoxRow): CollectionBox {
  const statuses = (r.model_boxes ?? [])
    .map(mb => mb.model?.status)
    .filter((s): s is ModelStatus => !!s);
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    includesString: r.includes_string,
    game: r.game,
    modelCount: r.model_boxes?.length ?? 0,
    allPainted: statuses.length > 0 && statuses.every(s => s === 'Painted'),
    images: boxCarouselImages(r),
  };
}

// ── Generic paged loader ──────────────────────────────────────────────────────
//
// Both collection lists page identically (newest first, appended as the column
// is scrolled), differing only in table/select/mapper — so the fetch-a-page,
// load-more, refetch-the-window machinery lives here once. Mirrors useBattles.

interface PagedList<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryStep = (q: any) => any;

/** Default filter: leave the query untouched. Module-level so the reference is
 *  stable across renders — an inline `q => q` default would be a new function
 *  each render, re-triggering the load effect and looping forever. */
const NO_FILTER: QueryStep = q => q;

function usePagedCollection<Row, T>(
  userId: string | null,
  table: string,
  select: string,
  map: (row: Row) => T,
  /** Adds filters to the query (e.g. status). Must be stable across renders. */
  applyFilter: QueryStep = NO_FILTER,
): PagedList<T> {
  const [items,       setItems]       = useState<T[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  // Rows currently loaded — a ref so loadMore/refetch stay stable across renders.
  const loadedRef = useRef(0);
  // Bumped on every full (re)load; a fetch whose generation is stale when it
  // resolves is dropped, so out-of-order responses (e.g. from a rapid filter
  // change) can't overwrite the latest result.
  const genRef = useRef(0);

  const fetchRange = useCallback((from: number, to: number) =>
    applyFilter(
      supabase
        .from(table)
        .select(select)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false }))
      .range(from, to)
      .then(({ data }: { data: unknown }) => ((data as Row[]) ?? []).map(map)),
    [userId, table, select, map, applyFilter]);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    if (!userId) { loadedRef.current = 0; setItems([]); setHasMore(false); setLoading(false); return; }
    setLoading(true);
    const rows = await fetchRange(0, PAGE_SIZE - 1);
    if (gen !== genRef.current) return;   // a newer load has superseded this one
    loadedRef.current = rows.length;
    setItems(rows);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }, [userId, fetchRange]);

  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || !hasMore) return;
    const gen = genRef.current;
    setLoadingMore(true);
    const from = loadedRef.current;
    const rows = await fetchRange(from, from + PAGE_SIZE - 1);
    if (gen !== genRef.current) { setLoadingMore(false); return; }  // a reload happened; drop this page
    setItems(prev => {
      const next = [...prev, ...rows];
      loadedRef.current = next.length;
      return next;
    });
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [userId, loadingMore, hasMore, fetchRange]);

  const refetch = useCallback(async () => {
    const gen = ++genRef.current;
    if (!userId) { loadedRef.current = 0; setItems([]); setHasMore(false); return; }
    const count = Math.max(PAGE_SIZE, loadedRef.current);
    const rows = await fetchRange(0, count - 1);
    if (gen !== genRef.current) return;
    loadedRef.current = rows.length;
    setItems(rows);
    setHasMore(rows.length === count);
  }, [userId, fetchRange]);

  useEffect(() => { load(); }, [load]);

  return { items, loading, loadingMore, hasMore, loadMore, refetch };
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useModels(userId: string | null, filter: CollectionFilter = 'all', search = '') {
  const applyFilter = useCallback<QueryStep>(q => {
    let x = q;
    if (search)               x = x.ilike('name', `%${search}%`);
    if (filter === 'painted') x = x.eq('status', 'Painted');
    return x;
  }, [filter, search]);
  const { items, ...rest } = usePagedCollection<ModelRow, CollectionModel>(
    userId, 'models', MODEL_SELECT, mapModel, applyFilter);
  return { models: items, ...rest };
}

export function useBoxes(userId: string | null, search = '', gameIds: string[] = []) {
  const applyFilter = useCallback<QueryStep>(q => {
    // Strip characters that would break PostgREST's or() logic-tree parsing.
    const safe = search.replace(/[(),*]/g, ' ').trim();
    if (!safe) return q;
    // A collection search also matches its game's name. games.name can't be
    // referenced in a top-level `or` (only boxes columns can), so the caller
    // resolves matching game ids and we `or` on the boxes.game_id column.
    const clauses = [`name.ilike.*${safe}*`];
    if (gameIds.length) clauses.push(`game_id.in.(${gameIds.join(',')})`);
    return q.or(clauses.join(','));
  }, [search, gameIds]);

  const { items, ...rest } = usePagedCollection<BoxRow, CollectionBox>(
    userId, 'boxes', BOX_SELECT, mapBox, applyFilter);
  return { boxes: items, ...rest };
}

/**
 * The ids of games whose name matches `search`, so a collection search can also
 * surface collections by their game's name. Returns [] until resolved / when the
 * search is empty.
 */
const NO_GAME_IDS: string[] = [];

export function useMatchingGameIds(search: string): string[] {
  const [match, setMatch] = useState<{ term: string; ids: string[] }>({ term: '', ids: NO_GAME_IDS });
  useEffect(() => {
    if (!search) { setMatch({ term: '', ids: NO_GAME_IDS }); return; }
    let cancelled = false;
    supabase.from('games').select('id').ilike('name', `%${search}%`)
      .then(({ data }) => {
        if (!cancelled) setMatch({ term: search, ids: ((data as { id: string }[] | null) ?? []).map(g => g.id) });
      });
    return () => { cancelled = true; };
  }, [search]);
  // Only use ids resolved for the current term (avoids a stale previous match).
  // Returns a stable empty array while unresolved so the query doesn't churn.
  return match.term === search ? match.ids : NO_GAME_IDS;
}

// ── Model detail (the click-a-model modal) ────────────────────────────────────

/** A paint used on a model, resolved for display. */
export interface PaintRef {
  name: string;
  brand: string;
  type: string;            // 'Paint' | 'Spray'
  swatch: string | null;
  /** Where/how it was used (a model_hobby_items.section note). */
  note: string | null;
}

/** A recipe applied to a model: a named, ordered group of paints. */
export interface ModelRecipeGroup {
  name: string;
  description: string | null;
  paints: PaintRef[];
}

export interface ModelDetail {
  id: string;
  name: string;
  game: CollectionGame | null;
  status: ModelStatus;
  count: number;
  purchaseDate: string | null;
  paintedDate: string | null;
  paintingNotes: string | null;
  loreName: string | null;
  loreDescription: string | null;
  /** The model's photos, primary first — the modal's hero carousel. */
  images: string[];
  /** The boxes/collections this model belongs to. */
  includedIn: CollectionBox[];
  /** Recipes applied to the model. */
  recipes: ModelRecipeGroup[];
  /** Individual paints applied outside a recipe. */
  directPaints: PaintRef[];
}

interface HobbyItemRef { name: string; brand: string; type: string; swatch: string | null }

interface ModelDetailRow {
  id: string;
  name: string;
  status: ModelStatus;
  count: number;
  image_path: string | null;
  purchase_date: string | null;
  painted_date: string | null;
  painting_notes: string | null;
  lore_name: string | null;
  lore_description: string | null;
  game: CollectionGame | null;
  model_images: ModelImageRow[] | null;
  model_boxes: { box: BoxRow | null }[] | null;
  model_recipes: {
    description: string | null;
    sort_order: number;
    recipe: { name: string; description: string | null; recipe_items: { display_order: number; hobby_item: HobbyItemRef | null }[] | null } | null;
  }[] | null;
  model_hobby_items: { section: string | null; sort_order: number; hobby_item: HobbyItemRef | null }[] | null;
}

const MODEL_DETAIL_SELECT =
  'id, name, status, count, image_path, purchase_date, painted_date, painting_notes, lore_name, lore_description, ' +
  'game:games ( name, slug ), ' +
  'model_images ( image_path, is_primary, display_order ), ' +
  'model_boxes ( box:boxes ( id, name, type, includes_string, game:games ( name, slug ), ' +
    'box_images ( image_path, image_url, is_primary, display_order ), model_boxes ( model:models ( image_path, status ) ) ) ), ' +
  'model_recipes ( description, sort_order, recipe:recipes ( name, description, recipe_items ( display_order, hobby_item:hobby_items ( name, brand, type, swatch ) ) ) ), ' +
  'model_hobby_items ( section, sort_order, hobby_item:hobby_items ( name, brand, type, swatch ) )';

function paintRef(h: HobbyItemRef | null, note: string | null): PaintRef | null {
  if (!h) return null;
  return { name: h.name, brand: h.brand, type: h.type, swatch: h.swatch, note: note || null };
}

function mapModelDetail(r: ModelDetailRow): ModelDetail {
  const isPaint = (p: PaintRef | null): p is PaintRef => !!p;
  return {
    id: r.id,
    name: r.name,
    game: r.game,
    status: r.status,
    count: r.count,
    purchaseDate: r.purchase_date,
    paintedDate: r.painted_date,
    paintingNotes: r.painting_notes,
    loreName: r.lore_name,
    loreDescription: r.lore_description,
    images: modelCarouselImages(r.model_images, r.image_path),
    includedIn: (r.model_boxes ?? []).map(mb => mb.box).filter((b): b is BoxRow => !!b).map(mapBox),
    recipes: (r.model_recipes ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(mr => ({
        name: mr.recipe?.name ?? 'Recipe',
        description: mr.description || mr.recipe?.description || null,
        paints: (mr.recipe?.recipe_items ?? [])
          .slice()
          .sort((a, b) => a.display_order - b.display_order)
          .map(ri => paintRef(ri.hobby_item, null))
          .filter(isPaint),
      })),
    directPaints: (r.model_hobby_items ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(mhi => paintRef(mhi.hobby_item, mhi.section))
      .filter(isPaint),
  };
}

/** Full detail for one model, for the click-a-model modal. */
export function useModelDetail(modelId: string | null) {
  const [model,   setModel]   = useState<ModelDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(() => {
    if (!modelId) { setModel(null); setLoading(false); return; }
    setLoading(true);
    supabase.from('models').select(MODEL_DETAIL_SELECT).eq('id', modelId).single()
      .then(({ data }) => {
        setModel(data ? mapModelDetail(data as unknown as ModelDetailRow) : null);
        setLoading(false);
      });
  }, [modelId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { model, loading, refetch };
}

/** Fields editable inline from the model modal. */
export type ModelPatch = Partial<{
  status: ModelStatus;
  painting_notes: string | null;
  lore_name: string | null;
  lore_description: string | null;
}>;

/** Persist an inline edit to a model. RLS restricts this to the owner. */
export function updateModel(modelId: string, patch: ModelPatch) {
  return supabase.from('models').update(patch).eq('id', modelId);
}
