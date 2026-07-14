import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@battleplans/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModelStatus = 'None' | 'Assembled' | 'Primed' | 'Partially Painted' | 'Painted';

export interface CollectionGame {
  name: string;
  slug: string;
}

export interface CollectionModel {
  id: string;
  name: string;
  status: ModelStatus;
  count: number;
  imagePath: string | null;
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
  /** Resolved URL of the box's primary cover image, or null. */
  imageUrl: string | null;
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

interface ModelRow {
  id: string;
  name: string;
  status: ModelStatus;
  count: number;
  image_path: string | null;
  game: CollectionGame | null;
  model_boxes: { box: { name: string } | null }[] | null;
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
  model_boxes: { count: number }[] | null;
  box_images: BoxImageRow[] | null;
}

const MODEL_SELECT =
  'id, name, status, count, image_path, game:games ( name, slug ), model_boxes ( box:boxes ( name ) )';
const BOX_SELECT =
  'id, name, type, includes_string, game:games ( name, slug ), model_boxes ( count ), ' +
  'box_images ( image_path, image_url, is_primary, display_order )';

/** How many rows are fetched per page as the collection is scrolled. */
const PAGE_SIZE = 24;

function mapModel(r: ModelRow): CollectionModel {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    count: r.count,
    imagePath: r.image_path,
    game: r.game,
    boxName: r.model_boxes?.find(mb => mb.box)?.box?.name ?? null,
  };
}

/**
 * A box's cover image: the primary box_image (else the lowest display_order),
 * resolved to a URL. Bucket-hosted images keep an object path (built into a URL
 * via the model-images bucket); externally-linked cover art keeps a full URL.
 */
function boxImageUrl(images: BoxImageRow[] | null): string | null {
  if (!images || images.length === 0) return null;
  const primary = images.find(i => i.is_primary)
    ?? [...images].sort((a, b) => a.display_order - b.display_order)[0];
  if (!primary) return null;
  return primary.image_path ? modelImageUrl(primary.image_path) : (primary.image_url ?? null);
}

function mapBox(r: BoxRow): CollectionBox {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    includesString: r.includes_string,
    game: r.game,
    modelCount: r.model_boxes?.[0]?.count ?? 0,
    imageUrl: boxImageUrl(r.box_images),
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

function usePagedCollection<Row, T>(
  userId: string | null,
  table: string,
  select: string,
  map: (row: Row) => T,
): PagedList<T> {
  const [items,       setItems]       = useState<T[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  // Rows currently loaded — a ref so loadMore/refetch stay stable across renders.
  const loadedRef = useRef(0);

  const fetchRange = useCallback((from: number, to: number) =>
    supabase
      .from(table)
      .select(select)
      .eq('user_id', userId!)
      .order('created_at', { ascending: false })
      .range(from, to)
      .then(({ data }) => ((data as unknown as Row[]) ?? []).map(map)),
    [userId, table, select, map]);

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

export function useModels(userId: string | null) {
  const { items, ...rest } = usePagedCollection<ModelRow, CollectionModel>(
    userId, 'models', MODEL_SELECT, mapModel);
  return { models: items, ...rest };
}

export function useBoxes(userId: string | null) {
  const { items, ...rest } = usePagedCollection<BoxRow, CollectionBox>(
    userId, 'boxes', BOX_SELECT, mapBox);
  return { boxes: items, ...rest };
}
