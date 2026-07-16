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
  /** True when the collection has models and every one is unpainted ('None'). */
  allUnpainted: boolean;
  /** True when any member has a status other than unpainted. */
  anyProgress: boolean;
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
    allPainted:   statuses.length > 0 && statuses.every(s => s === 'Painted'),
    allUnpainted: statuses.length > 0 && statuses.every(s => s === 'None'),
    anyProgress:  statuses.some(s => s !== 'None'),
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
  // In-flight guard for loadMore as a ref, so two rapid calls can't both pass
  // the check before the `loadingMore` state updates — which would append the
  // same page twice and produce duplicate keys.
  const loadingMoreRef = useRef(false);

  const fetchRange = useCallback((from: number, to: number) =>
    applyFilter(
      supabase
        .from(table)
        .select(select)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }))
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
    if (!userId || loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    const gen = genRef.current;
    setLoadingMore(true);
    const from = loadedRef.current;
    const rows = await fetchRange(from, from + PAGE_SIZE - 1);
    loadingMoreRef.current = false;
    if (gen !== genRef.current) { setLoadingMore(false); return; }  // a reload happened; drop this page
    setItems(prev => {
      // Skip any rows already loaded — a defensive guard against overlap.
      const seen = new Set(prev.map(i => (i as { id: string }).id));
      const next = [...prev, ...rows.filter((r: { id: string }) => !seen.has(r.id))];
      loadedRef.current = next.length;
      return next;
    });
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [userId, hasMore, fetchRange]);

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

/** The full set of model filters, applied together by the filter sheet. */
export interface ModelFilters {
  purchaseFrom: string | null;   // 'YYYY-MM-DD'
  purchaseTo:   string | null;
  paintedFrom:  string | null;
  paintedTo:    string | null;
  /** Selected statuses (empty = any). */
  statuses:     ModelStatus[];
  /** Selected game ids (empty = any). */
  gameIds:      string[];
}

export const EMPTY_MODEL_FILTERS: ModelFilters = {
  purchaseFrom: null, purchaseTo: null, paintedFrom: null, paintedTo: null, statuses: [], gameIds: [],
};

/** How many filter groups are active — for the "Filters (N)" badge. */
export function activeModelFilterCount(f: ModelFilters): number {
  return (
    (f.purchaseFrom || f.purchaseTo ? 1 : 0) +
    (f.paintedFrom  || f.paintedTo  ? 1 : 0) +
    (f.statuses.length ? 1 : 0) +
    (f.gameIds.length  ? 1 : 0)
  );
}

export function useModels(userId: string | null, filters: ModelFilters, search = '') {
  const applyFilter = useCallback<QueryStep>(q => {
    let x = q;
    if (search)                  x = x.ilike('name', `%${search}%`);
    if (filters.statuses.length) x = x.in('status', filters.statuses);
    if (filters.gameIds.length)  x = x.in('game_id', filters.gameIds);
    if (filters.purchaseFrom)    x = x.gte('purchase_date', filters.purchaseFrom);
    if (filters.purchaseTo)      x = x.lte('purchase_date', filters.purchaseTo);
    if (filters.paintedFrom)     x = x.gte('painted_date', filters.paintedFrom);
    if (filters.paintedTo)       x = x.lte('painted_date', filters.paintedTo);
    return x;
  }, [filters, search]);
  const { items, ...rest } = usePagedCollection<ModelRow, CollectionModel>(
    userId, 'models', MODEL_SELECT, mapModel, applyFilter);
  return { models: items, ...rest };
}

export interface OwnedGame { id: string; name: string; slug: string; count: number }

/** The distinct games the user owns items in, with how many of each — for the
 *  Game filter list (`count` is the number of entries in that game). Pass
 *  'boxes' to list the games the user has collections in. */
export function useOwnedGames(userId: string | null, table: 'models' | 'boxes' = 'models') {
  const [games, setGames] = useState<OwnedGame[]>([]);
  useEffect(() => {
    if (!userId) { setGames([]); return; }
    let cancelled = false;
    supabase.from(table).select('game:games ( id, name, slug )').eq('user_id', userId)
      .then(({ data }) => {
        if (cancelled) return;
        const byId = new Map<string, OwnedGame>();
        for (const row of (data as { game: { id: string; name: string; slug: string } | null }[] | null) ?? []) {
          if (!row.game) continue;
          const g = byId.get(row.game.id);
          if (g) g.count += 1;
          else byId.set(row.game.id, { ...row.game, count: 1 });
        }
        setGames([...byId.values()].sort((a, b) => a.name.localeCompare(b.name)));
      });
    return () => { cancelled = true; };
  }, [userId, table]);
  return games;
}

/** The distinct years present in a date column (descending) — for the date
 *  filter presets. e.g. useAvailableYears(userId, 'models', 'purchase_date'). */
export function useAvailableYears(userId: string | null, table: 'models' | 'boxes', column: 'purchase_date' | 'painted_date') {
  const [years, setYears] = useState<number[]>([]);
  useEffect(() => {
    if (!userId) { setYears([]); return; }
    let cancelled = false;
    supabase.from(table).select(column).eq('user_id', userId).not(column, 'is', null)
      .then(({ data }) => {
        if (cancelled) return;
        const set = new Set<number>();
        for (const row of (data as Record<string, string | null>[] | null) ?? []) {
          const v = row[column];
          if (v) set.add(Number(v.slice(0, 4)));
        }
        setYears([...set].sort((a, b) => b - a));
      });
    return () => { cancelled = true; };
  }, [userId, table, column]);
  return years;
}

/** Which paint state a collection falls into, by its members' statuses. */
export type CollectionPaint = 'fully' | 'partial' | 'unpainted';

/** The full set of collection filters, applied together by the filter sheet.
 *  Everything but `paint` is applied server-side; `paint` is client-side (it
 *  reads members' statuses) over the loaded pages. */
export interface CollectionFilters {
  purchaseFrom: string | null;
  purchaseTo:   string | null;
  types:        ('Box' | 'Collection')[];
  paint:        CollectionPaint[];
  gameIds:      string[];
}

export const EMPTY_COLLECTION_FILTERS: CollectionFilters = {
  purchaseFrom: null, purchaseTo: null, types: [], paint: [], gameIds: [],
};

export function activeCollectionFilterCount(f: CollectionFilters): number {
  return (
    (f.paint.length ? 1 : 0) +
    (f.types.length ? 1 : 0) +
    (f.gameIds.length ? 1 : 0) +
    (f.purchaseFrom || f.purchaseTo ? 1 : 0)
  );
}

/** Client-side paint filter — a collection matches if it falls into any of the
 *  selected categories (empty = any). */
export function matchesCollectionPaint(box: CollectionBox, cats: CollectionPaint[]): boolean {
  if (!cats.length) return true;
  return (
    (cats.includes('fully')     && box.allPainted) ||
    (cats.includes('partial')   && box.anyProgress) ||
    (cats.includes('unpainted') && box.allUnpainted)
  );
}

export function useBoxes(userId: string | null, filters: CollectionFilters, search = '', searchGameIds: string[] = []) {
  const applyFilter = useCallback<QueryStep>(q => {
    let x = q;
    // Strip characters that would break PostgREST's or() logic-tree parsing.
    const safe = search.replace(/[(),*]/g, ' ').trim();
    if (safe) {
      // A collection search also matches its game's name. games.name can't be
      // referenced in a top-level `or` (only boxes columns can), so the caller
      // resolves matching game ids and we `or` on the boxes.game_id column.
      const clauses = [`name.ilike.*${safe}*`];
      if (searchGameIds.length) clauses.push(`game_id.in.(${searchGameIds.join(',')})`);
      x = x.or(clauses.join(','));
    }
    if (filters.gameIds.length) x = x.in('game_id', filters.gameIds);
    if (filters.types.length)   x = x.in('type', filters.types);
    if (filters.purchaseFrom)   x = x.gte('purchase_date', filters.purchaseFrom);
    if (filters.purchaseTo)     x = x.lte('purchase_date', filters.purchaseTo);
    return x;
  }, [search, searchGameIds, filters]);

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
  /** The hobby_items id — for unlinking a direct paint from the model. */
  hobbyItemId: number;
  name: string;
  brand: string;
  type: string;            // 'Paint' | 'Spray'
  swatch: string | null;
  /** Where/how it was used (a model_hobby_items.section note). */
  note: string | null;
}

/** A recipe applied to a model: a named, ordered group of paints. */
export interface ModelRecipeGroup {
  /** The recipes id — for unlinking the recipe from the model. */
  id: string;
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

interface HobbyItemRef { id: number; name: string; brand: string; type: string; swatch: string | null }

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
    recipe: { id: string; name: string; description: string | null; recipe_items: { display_order: number; hobby_item: HobbyItemRef | null }[] | null } | null;
  }[] | null;
  model_hobby_items: { section: string | null; sort_order: number; hobby_item: HobbyItemRef | null }[] | null;
}

const MODEL_DETAIL_SELECT =
  'id, name, status, count, image_path, purchase_date, painted_date, painting_notes, lore_name, lore_description, ' +
  'game:games ( name, slug ), ' +
  'model_images ( image_path, is_primary, display_order ), ' +
  'model_boxes ( box:boxes ( id, name, type, includes_string, game:games ( name, slug ), ' +
    'box_images ( image_path, image_url, is_primary, display_order ), model_boxes ( model:models ( image_path, status ) ) ) ), ' +
  'model_recipes ( description, sort_order, recipe:recipes ( id, name, description, recipe_items ( display_order, hobby_item:hobby_items ( id, name, brand, type, swatch ) ) ) ), ' +
  'model_hobby_items ( section, sort_order, hobby_item:hobby_items ( id, name, brand, type, swatch ) )';

function paintRef(h: HobbyItemRef | null, note: string | null): PaintRef | null {
  if (!h) return null;
  return { hobbyItemId: h.id, name: h.name, brand: h.brand, type: h.type, swatch: h.swatch, note: note || null };
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
        id: mr.recipe?.id ?? '',
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

// ── Collection detail (the click-a-collection modal) ──────────────────────────

export interface BoxDetail {
  id: string;
  name: string;
  type: 'Box' | 'Collection';
  game: CollectionGame | null;
  purchaseDate: string | null;
  includesString: string | null;
  /** How many models are in this collection. */
  modelCount: number;
  /** True when the collection has models and every one is painted. */
  allPainted: boolean;
  /** The collection's photos — the modal's hero carousel. */
  images: string[];
  /** The models in this collection — the "Includes" list. */
  includes: CollectionModel[];
}

interface BoxMemberRow {
  id: string;
  name: string;
  status: ModelStatus;
  count: number;
  image_path: string | null;
  game: CollectionGame | null;
  model_images: ModelImageRow[] | null;
}

interface BoxDetailRow {
  id: string;
  name: string;
  type: 'Box' | 'Collection';
  purchase_date: string | null;
  includes_string: string | null;
  image_path: string | null;
  game: CollectionGame | null;
  box_images: BoxImageRow[] | null;
  model_boxes: { model: BoxMemberRow | null }[] | null;
}

const BOX_DETAIL_SELECT =
  'id, name, type, purchase_date, includes_string, image_path, game:games ( name, slug ), ' +
  'box_images ( image_path, image_url, is_primary, display_order ), ' +
  'model_boxes ( model:models ( id, name, status, count, image_path, ' +
    'game:games ( name, slug ), model_images ( image_path, is_primary, display_order ) ) )';

/** A collection member, mapped for a ModelItem row. `boxName` is dropped (null)
 *  — it's redundant inside the collection it belongs to, so the row's subtitle
 *  falls back to the game name. */
function mapMember(m: BoxMemberRow): CollectionModel {
  return {
    id: m.id,
    name: m.name,
    status: m.status,
    count: m.count,
    images: modelCarouselImages(m.model_images, m.image_path),
    game: m.game,
    boxName: null,
  };
}

function mapBoxDetail(r: BoxDetailRow): BoxDetail {
  const members = (r.model_boxes ?? []).map(mb => mb.model).filter((m): m is BoxMemberRow => !!m);
  const statuses = members.map(m => m.status);
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    game: r.game,
    purchaseDate: r.purchase_date,
    includesString: r.includes_string,
    modelCount: members.length,
    allPainted: statuses.length > 0 && statuses.every(s => s === 'Painted'),
    images: boxCarouselImages(r as unknown as BoxRow),
    includes: members.map(mapMember),
  };
}

/** Full detail for one collection, for the click-a-collection modal. */
export function useBoxDetail(boxId: string | null) {
  const [box,     setBox]     = useState<BoxDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(() => {
    if (!boxId) { setBox(null); setLoading(false); return; }
    setLoading(true);
    supabase.from('boxes').select(BOX_DETAIL_SELECT).eq('id', boxId).single()
      .then(({ data }) => {
        setBox(data ? mapBoxDetail(data as unknown as BoxDetailRow) : null);
        setLoading(false);
      });
  }, [boxId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { box, loading, refetch };
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

// ── Add paints / recipes to a model ───────────────────────────────────────────

/** A paint (hobby_item) or recipe as shown in the "add existing" picker. */
export interface PaintOption   { id: number; name: string; brand: string; type: string; swatch: string | null }
export interface RecipeOption  { id: string; name: string; description: string | null }

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** A page of the paint library (public paints + the user's own), name-searched
 *  and optionally filtered to a set of brands. */
export async function searchPaints(query: string, page: number, brands: string[] = [], pageSize = 8): Promise<{ items: PaintOption[]; total: number }> {
  const uid = await currentUserId();
  let q = supabase.from('hobby_items').select('id, name, brand, type, swatch', { count: 'exact' });
  q = uid ? q.or(`public.eq.true,owner.eq.${uid}`) : q.eq('public', true);
  const term = query.trim();
  if (term) q = q.ilike('name', `%${term}%`);
  if (brands.length) q = q.in('brand', brands);
  const { data, count } = await q.order('name').range(page * pageSize, page * pageSize + pageSize - 1);
  return { items: (data as PaintOption[]) ?? [], total: count ?? 0 };
}

/** All distinct brands in the paint library (public + owned), for the brand
 *  filter. Only fetched when `enabled` (the Add Paint picker is showing). */
export function useHobbyBrands(enabled: boolean): string[] {
  const [brands, setBrands] = useState<string[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    supabase.from('hobby_item_brands').select('brand')
      .then(({ data }) => {
        if (cancelled) return;
        setBrands(((data as { brand: string }[] | null) ?? []).map(r => r.brand));
      });
    return () => { cancelled = true; };
  }, [enabled]);
  return brands;
}

/** Create a new (private) paint owned by the user; returns its id. */
export async function createPaint(fields: { name: string; brand: string; type: 'Paint' | 'Spray'; swatch: string }): Promise<number | null> {
  const uid = await currentUserId();
  const { data, error } = await supabase.from('hobby_items')
    .insert({ name: fields.name, brand: fields.brand, type: fields.type, swatch: fields.swatch, owner: uid, public: false })
    .select('id').single();
  if (error) { console.error('[createPaint]', error); return null; }
  return (data as { id: number }).id;
}

/** Link a paint to a model (with an optional "where used" note). */
export function addModelPaint(modelId: string, hobbyItemId: number, note: string | null) {
  return supabase.from('model_hobby_items').insert({ model_id: modelId, hobby_item_id: hobbyItemId, section: note });
}

/** Unlink a paint from a model. */
export function removeModelPaint(modelId: string, hobbyItemId: number) {
  return supabase.from('model_hobby_items').delete().eq('model_id', modelId).eq('hobby_item_id', hobbyItemId);
}

/** A page of the user's recipes, name-searched. */
export async function searchRecipes(query: string, page: number, pageSize = 8): Promise<{ items: RecipeOption[]; total: number }> {
  const uid = await currentUserId();
  if (!uid) return { items: [], total: 0 };
  let q = supabase.from('recipes').select('id, name, description', { count: 'exact' }).eq('owner', uid);
  const term = query.trim();
  if (term) q = q.ilike('name', `%${term}%`);
  const { data, count } = await q.order('name').range(page * pageSize, page * pageSize + pageSize - 1);
  return { items: (data as RecipeOption[]) ?? [], total: count ?? 0 };
}

/** Create a new recipe owned by the user; returns its id. */
export async function createRecipe(fields: { name: string; description: string | null }): Promise<string | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase.from('recipes')
    .insert({ name: fields.name, description: fields.description, owner: uid })
    .select('id').single();
  if (error) { console.error('[createRecipe]', error); return null; }
  return (data as { id: string }).id;
}

/** Link a recipe to a model. */
export function addModelRecipe(modelId: string, recipeId: string) {
  return supabase.from('model_recipes').insert({ model_id: modelId, recipe_id: recipeId });
}

/** Unlink a recipe from a model. */
export function removeModelRecipe(modelId: string, recipeId: string) {
  return supabase.from('model_recipes').delete().eq('model_id', modelId).eq('recipe_id', recipeId);
}
