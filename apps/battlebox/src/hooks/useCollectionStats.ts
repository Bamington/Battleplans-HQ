import { useEffect, useState } from 'react';
import { supabase } from '@battleplans/ui';
import type { StatModel, ModelStatus } from '../lib/collectionStats';

interface ModelStatsRow {
  id: string;
  count: number;
  status: ModelStatus;
  purchase_date: string | null;
  painted_date: string | null;
  game: { id: string; name: string; slug: string } | null;
  model_boxes: { box: { id: string; name: string; type: 'Box' | 'Collection' } | null }[] | null;
}

/**
 * Every one of the signed-in user's models (slim columns), plus a total
 * collections count, for the stats page. Unlike the paged collection lists this
 * pulls the whole library at once — stats need it all. Owner-only RLS scopes the
 * rows.
 */
export function useCollectionStats(userId: string | null) {
  const [models, setModels] = useState<StatModel[]>([]);
  const [collectionCount, setCollectionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setModels([]); setCollectionCount(0); setLoading(false); return; }
    setLoading(true);
    let cancelled = false;

    // Supabase caps a single response at 1000 rows regardless of .limit(), so
    // page through the whole collection — stats need every model.
    const PAGE = 1000;
    const SELECT = 'id, count, status, purchase_date, painted_date, game:games(id, name, slug), model_boxes(box:boxes(id, name, type))';

    (async () => {
      const all: ModelStatsRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data } = await supabase.from('models').select(SELECT)
          .eq('user_id', userId)
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (cancelled) return;
        const rows = (data as unknown as ModelStatsRow[]) ?? [];
        all.push(...rows);
        if (rows.length < PAGE) break;
      }
      const { count } = await supabase.from('boxes').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      if (cancelled) return;

      setModels(all.map(r => ({
        id: r.id,
        count: r.count,
        status: r.status,
        purchaseDate: r.purchase_date,
        paintedDate: r.painted_date,
        game: r.game,
        boxes: (r.model_boxes ?? []).map(mb => mb.box).filter((b): b is { id: string; name: string; type: 'Box' | 'Collection' } => !!b),
      })));
      setCollectionCount(count ?? 0);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId]);

  return { models, collectionCount, loading };
}
