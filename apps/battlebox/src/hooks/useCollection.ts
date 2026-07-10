import { useEffect, useState, useCallback } from 'react';
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

interface BoxRow {
  id: string;
  name: string;
  type: 'Box' | 'Collection';
  includes_string: string | null;
  game: CollectionGame | null;
  model_boxes: { count: number }[] | null;
}

const MODEL_SELECT =
  'id, name, status, count, image_path, game:games ( name, slug ), model_boxes ( box:boxes ( name ) )';
const BOX_SELECT =
  'id, name, type, includes_string, game:games ( name, slug ), model_boxes ( count )';

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useModels(userId: string | null) {
  const [models, setModels] = useState<CollectionModel[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!userId) { setModels([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('models')
      .select(MODEL_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data as ModelRow[] | null) ?? [];
        setModels(rows.map(r => ({
          id: r.id,
          name: r.name,
          status: r.status,
          count: r.count,
          imagePath: r.image_path,
          game: r.game,
          boxName: r.model_boxes?.find(mb => mb.box)?.box?.name ?? null,
        })));
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { models, loading, refetch };
}

export function useBoxes(userId: string | null) {
  const [boxes, setBoxes] = useState<CollectionBox[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!userId) { setBoxes([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('boxes')
      .select(BOX_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data as BoxRow[] | null) ?? [];
        setBoxes(rows.map(r => ({
          id: r.id,
          name: r.name,
          type: r.type,
          includesString: r.includes_string,
          game: r.game,
          modelCount: r.model_boxes?.[0]?.count ?? 0,
        })));
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { boxes, loading, refetch };
}
