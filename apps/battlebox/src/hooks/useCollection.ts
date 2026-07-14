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
    if (!userId) { loadedRef.current = 0; setItems([]); setHasMore(false); setLoading(false); return; }
    setLoading(true);
    const rows = await fetchRange(0, PAGE_SIZE - 1);
    loadedRef.current = rows.length;
    setItems(rows);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }, [userId, fetchRange]);

  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const from = loadedRef.current;
    const rows = await fetchRange(from, from + PAGE_SIZE - 1);
    setItems(prev => {
      const next = [...prev, ...rows];
      loadedRef.current = next.length;
      return next;
    });
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [userId, loadingMore, hasMore, fetchRange]);

  const refetch = useCallback(async () => {
    if (!userId) { loadedRef.current = 0; setItems([]); setHasMore(false); return; }
    const count = Math.max(PAGE_SIZE, loadedRef.current);
    const rows = await fetchRange(0, count - 1);
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

export function useBoxes(userId: string | null, search = '') {
  const applyFilter = useCallback<QueryStep>(
    q => (search ? q.ilike('name', `%${search}%`) : q),
    [search]);
  const { items, ...rest } = usePagedCollection<BoxRow, CollectionBox>(
    userId, 'boxes', BOX_SELECT, mapBox, applyFilter);
  return { boxes: items, ...rest };
}
