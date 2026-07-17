/**
 * usePaintPacks.ts — Browse paint packs, track which the user has added, read a
 * pack's paint contents, and add/remove a pack.
 *
 * Reference model (see the 20260716140000_paint_packs migration): adding a pack
 * writes one paint_pack_imports row. No paint rows are duplicated.
 */

import { useCallback, useEffect, useState } from 'react';
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
  /** True when the user already has this pack in their collection. */
  added: boolean;
}

const PACK_SELECT = 'id, owner, name, description, brand, is_public, is_official, item_count';

/** Every public paint pack, ordered by name, each flagged with whether the
 *  current user has added it. */
export function usePaintPacks(userId: string | null) {
  const [packs,   setPacks]   = useState<PaintPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [publicRes, importsRes] = await Promise.all([
        supabase.from('paint_pack_summary').select(PACK_SELECT).eq('is_public', true).order('name'),
        userId
          ? supabase.from('paint_pack_imports').select('pack_id')
          : Promise.resolve({ data: [] as { pack_id: string }[], error: null }),
      ]);
      if (publicRes.error)  throw publicRes.error;
      if (importsRes.error) throw importsRes.error;

      const added = new Set((importsRes.data ?? []).map(r => r.pack_id));
      setPacks(((publicRes.data as Omit<PaintPack, 'added'>[]) ?? []).map(p => ({ ...p, added: added.has(p.id) })));
    } catch {
      setError('Failed to load paint packs. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { packs, loading, error, refetch: load };
}

/** Add a pack to the user's collection (one import row). */
export function addPaintPack(userId: string, packId: string) {
  return supabase.from('paint_pack_imports').insert({ user_id: userId, pack_id: packId });
}

/** Remove a previously-added pack. */
export function removePaintPack(userId: string, packId: string) {
  return supabase.from('paint_pack_imports').delete().eq('user_id', userId).eq('pack_id', packId);
}

// ── Pack contents ─────────────────────────────────────────────────────────────

export interface LibraryPaint {
  id: number;
  name: string;
  brand: string;
  sub_brand: string | null;
  type: string;
  swatch: string;
}

interface PackItemRow {
  hobby_items: LibraryPaint | LibraryPaint[] | null;
}

/** The paints in a pack, in display order — for the View Pack modal. */
export async function fetchPackPaints(packId: string): Promise<LibraryPaint[]> {
  const { data } = await supabase.from('paint_pack_items')
    .select('display_order, hobby_items ( id, name, brand, sub_brand, type, swatch )')
    .eq('pack_id', packId)
    .order('display_order', { ascending: true });
  return ((data as PackItemRow[]) ?? [])
    .map(r => (Array.isArray(r.hobby_items) ? r.hobby_items[0] : r.hobby_items))
    .filter((p): p is LibraryPaint => !!p);
}

// ── Admin: pack authoring ─────────────────────────────────────────────────────
// Admins can see and manage every pack (the "Admins manage all paint packs" RLS
// policy). Packs authored here are system/official packs with owner IS NULL.

export interface PaintPackFields {
  name: string;
  brand: string | null;
  description: string | null;
  is_public: boolean;
  is_official: boolean;
}

/** Every pack, for the admin list (not just public ones). */
export async function fetchAllPacks(): Promise<PaintPack[]> {
  const { data } = await supabase.from('paint_pack_summary').select(PACK_SELECT).order('name');
  return ((data as Omit<PaintPack, 'added'>[]) ?? []).map(p => ({ ...p, added: false }));
}

export async function createPaintPack(fields: PaintPackFields): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.from('paint_packs')
    .insert({ ...fields, owner: null })
    .select('id').single();
  return { id: (data as { id: string } | null)?.id ?? null, error: error?.message ?? null };
}

export function updatePaintPack(id: string, fields: Partial<PaintPackFields>) {
  return supabase.from('paint_packs').update(fields).eq('id', id);
}

export function deletePaintPack(id: string) {
  return supabase.from('paint_packs').delete().eq('id', id);
}

export async function fetchPaintPackEdit(id: string): Promise<PaintPackFields | null> {
  const { data } = await supabase.from('paint_packs')
    .select('name, brand, description, is_public, is_official').eq('id', id).single();
  return (data as PaintPackFields) ?? null;
}

/** Add paints to a pack, appending after the existing ones. */
export async function addPackItems(packId: string, hobbyItemIds: number[], startOrder = 0): Promise<{ error: string | null }> {
  if (!hobbyItemIds.length) return { error: null };
  const rows = hobbyItemIds.map((id, i) => ({ pack_id: packId, hobby_item_id: id, display_order: startOrder + i }));
  const { error } = await supabase.from('paint_pack_items').insert(rows);
  return { error: error?.message ?? null };
}

export function removePackItem(packId: string, hobbyItemId: number) {
  return supabase.from('paint_pack_items').delete().eq('pack_id', packId).eq('hobby_item_id', hobbyItemId);
}
