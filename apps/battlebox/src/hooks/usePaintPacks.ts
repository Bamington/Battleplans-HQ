/**
 * usePaintPacks.ts — Browse paint packs, track which the user has added, and
 * read the user's derived paint library.
 *
 * Reference model (see the 20260716140000_paint_packs migration): adding a pack
 * writes one paint_pack_imports row; the library is derived from imports via the
 * user_paints view. No paint rows are duplicated.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@battleplans/ui';

// ── Packs ─────────────────────────────────────────────────────────────────────

export interface PaintPack {
  id: string;
  owner: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  is_public: boolean;
  is_official: boolean;
  /** Paint count, from the paint_pack_summary view. */
  item_count: number;
  /** True for packs already in the user's collection (added or owned). */
  added?: boolean;
}

const PACK_SELECT = 'id, owner, name, description, brand, is_public, is_official, item_count';

/**
 * Splits paint packs into the two lists the Paints column shows:
 *   added  — packs the user has added (imported) or owns
 *   browse — public packs not yet added
 * Mirrors the BattleCards home-screen pack split.
 */
export function usePaintPacks(userId: string | null) {
  const [added,   setAdded]   = useState<PaintPack[]>([]);
  const [browse,  setBrowse]  = useState<PaintPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [publicRes, ownRes, importsRes] = await Promise.all([
        supabase.from('paint_pack_summary').select(PACK_SELECT).eq('is_public', true).order('name'),
        userId
          ? supabase.from('paint_pack_summary').select(PACK_SELECT).eq('owner', userId).order('name')
          : Promise.resolve({ data: [] as PaintPack[], error: null }),
        userId
          ? supabase.from('paint_pack_imports').select('pack_id')
          : Promise.resolve({ data: [] as { pack_id: string }[], error: null }),
      ]);
      if (publicRes.error)  throw publicRes.error;
      if (ownRes.error)     throw ownRes.error;
      if (importsRes.error) throw importsRes.error;

      const importedIds = new Set((importsRes.data ?? []).map(r => r.pack_id));

      // Imported packs may not be public (or may be someone else's public pack),
      // so fetch their full rows explicitly.
      let importedPacks: PaintPack[] = [];
      if (importedIds.size > 0) {
        const { data, error } = await supabase
          .from('paint_pack_summary').select(PACK_SELECT)
          .in('id', Array.from(importedIds)).order('name');
        if (error) throw error;
        importedPacks = (data as PaintPack[]) ?? [];
      }

      // Added = owned ∪ imported (dedup by id).
      const addedMap = new Map<string, PaintPack>();
      for (const p of (ownRes.data as PaintPack[]) ?? []) addedMap.set(p.id, p);
      for (const p of importedPacks)                       addedMap.set(p.id, p);

      setAdded(Array.from(addedMap.values()).map(p => ({ ...p, added: true })));
      setBrowse(((publicRes.data as PaintPack[]) ?? []).filter(p => !addedMap.has(p.id)));
    } catch {
      setError('Failed to load paint packs. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { added, browse, loading, error, refetch: load };
}

/** Add a pack to the user's collection (one import row). */
export function addPaintPack(userId: string, packId: string) {
  return supabase.from('paint_pack_imports').insert({ user_id: userId, pack_id: packId });
}

/** Remove a previously-added pack (its paints leave the derived library). */
export function removePaintPack(userId: string, packId: string) {
  return supabase.from('paint_pack_imports').delete().eq('user_id', userId).eq('pack_id', packId);
}

// ── Library (derived paints) ──────────────────────────────────────────────────

export interface LibraryPaint {
  id: number;
  name: string;
  brand: string;
  sub_brand: string | null;
  type: string;
  swatch: string;
}

const LIB_SELECT = 'id, name, brand, sub_brand, type, swatch';
const LIB_PAGE   = 40;

export interface PaintLibrary {
  paints: LibraryPaint[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

/**
 * The user's paint library from the user_paints view, ordered by brand then
 * name and paged for the column. The view is security_invoker and already
 * scopes to the caller, so no user filter is needed in the query.
 */
export function useUserPaints(userId: string | null): PaintLibrary {
  const [paints,      setPaints]      = useState<LibraryPaint[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const loadedRef      = useRef(0);
  const genRef         = useRef(0);
  const loadingMoreRef = useRef(false);

  const fetchRange = useCallback(async (from: number, to: number) => {
    const { data } = await supabase
      .from('user_paints').select(LIB_SELECT)
      .order('brand', { ascending: true })
      .order('sub_brand', { ascending: true, nullsFirst: true })
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to);
    return (data as LibraryPaint[]) ?? [];
  }, []);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    if (!userId) { loadedRef.current = 0; setPaints([]); setHasMore(false); setLoading(false); return; }
    setLoading(true);
    const rows = await fetchRange(0, LIB_PAGE - 1);
    if (gen !== genRef.current) return;
    loadedRef.current = rows.length;
    setPaints(rows);
    setHasMore(rows.length === LIB_PAGE);
    setLoading(false);
  }, [userId, fetchRange]);

  const loadMore = useCallback(async () => {
    if (!userId || loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    const gen = genRef.current;
    setLoadingMore(true);
    const from = loadedRef.current;
    const rows = await fetchRange(from, from + LIB_PAGE - 1);
    loadingMoreRef.current = false;
    if (gen !== genRef.current) { setLoadingMore(false); return; }
    setPaints(prev => {
      const seen = new Set(prev.map(p => p.id));
      const next = [...prev, ...rows.filter(r => !seen.has(r.id))];
      loadedRef.current = next.length;
      return next;
    });
    setHasMore(rows.length === LIB_PAGE);
    setLoadingMore(false);
  }, [userId, hasMore, fetchRange]);

  const refetch = useCallback(async () => {
    const gen = ++genRef.current;
    if (!userId) { loadedRef.current = 0; setPaints([]); setHasMore(false); return; }
    const count = Math.max(LIB_PAGE, loadedRef.current);
    const rows = await fetchRange(0, count - 1);
    if (gen !== genRef.current) return;
    loadedRef.current = rows.length;
    setPaints(rows);
    setHasMore(rows.length === count);
  }, [userId, fetchRange]);

  useEffect(() => { load(); }, [load]);

  return { paints, loading, loadingMore, hasMore, loadMore, refetch };
}
