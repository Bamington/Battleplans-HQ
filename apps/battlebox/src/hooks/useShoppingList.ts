/**
 * useShoppingList.ts — The user's shopping list (shopping_list_items).
 *
 * Deliberately simple: a title, a category (Box/Model, Paint or Other — just a
 * label for now), free-text notes, one optional photo, and a bought flag. Ticking an item off just marks it bought — nothing is created
 * elsewhere in the collection.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@battleplans/ui';
import { modelImageUrl } from './useCollection';
import type { EditableImage } from './useCollection';

/** What kind of thing an item is — asked for when it's added. Only a label
 *  for now; later work will hang behaviour off it. */
export type ShoppingCategory = 'model' | 'paint' | 'other';

/** The categories in the order they're offered, with their display labels. */
export const SHOPPING_CATEGORIES: { value: ShoppingCategory; label: string }[] = [
  { value: 'model', label: 'Box/Model' },
  { value: 'paint', label: 'Paint' },
  { value: 'other', label: 'Other' },
];

export const shoppingCategoryLabel = (c: ShoppingCategory) =>
  SHOPPING_CATEGORIES.find(x => x.value === c)?.label ?? 'Other';

export interface ShoppingItem {
  id: string;
  title: string;
  category: ShoppingCategory;
  notes: string | null;
  /** The photo's display URL, or null. */
  imageUrl: string | null;
  bought: boolean;
  boughtAt: string | null;
  createdAt: string;
}

interface ShoppingRow {
  id: string;
  title: string;
  category: ShoppingCategory;
  notes: string | null;
  image_path: string | null;
  bought: boolean;
  bought_at: string | null;
  created_at: string;
}

const SELECT = 'id, title, category, notes, image_path, bought, bought_at, created_at';
/** A shopping list is short; load it whole rather than paging. */
const MAX_ITEMS = 500;

function mapItem(r: ShoppingRow): ShoppingItem {
  return {
    id: r.id,
    title: r.title,
    category: r.category ?? 'other',
    notes: r.notes,
    imageUrl: modelImageUrl(r.image_path),
    bought: r.bought,
    boughtAt: r.bought_at,
    createdAt: r.created_at,
  };
}

/** Still-to-buy first (newest first), then bought (most recently bought first). */
export function sortShoppingItems(items: ShoppingItem[]): ShoppingItem[] {
  return items.slice().sort((a, b) =>
    Number(a.bought) - Number(b.bought) ||
    (a.bought
      ? (b.boughtAt ?? '').localeCompare(a.boughtAt ?? '')
      : b.createdAt.localeCompare(a.createdAt)));
}

export function useShoppingList(userId: string | null) {
  const [items,   setItems]   = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) { setItems([]); setLoading(false); return; }
    const { data } = await supabase.from('shopping_list_items')
      .select(SELECT).eq('user_id', userId).limit(MAX_ITEMS);
    setItems(sortShoppingItems(((data as ShoppingRow[]) ?? []).map(mapItem)));
    setLoading(false);
  }, [userId]);

  useEffect(() => { setLoading(true); refetch(); }, [refetch]);

  /** Tick an item on or off — updated on screen first, then saved. */
  const setBought = useCallback(async (id: string, bought: boolean) => {
    const boughtAt = bought ? new Date().toISOString() : null;
    setItems(prev => sortShoppingItems(prev.map(i => (i.id === id ? { ...i, bought, boughtAt } : i))));
    const { error } = await supabase.from('shopping_list_items')
      .update({ bought, bought_at: boughtAt }).eq('id', id);
    if (error) refetch();   // put the real state back
  }, [refetch]);

  return { items, loading, refetch, setBought, setItems };
}

/** Add an item by name and category; returns the new row, or null on failure. */
export async function addShoppingItem(userId: string, title: string, category: ShoppingCategory): Promise<ShoppingItem | null> {
  const { data, error } = await supabase.from('shopping_list_items')
    .insert({ user_id: userId, title: title.trim(), category })
    .select(SELECT).single();
  if (error) { console.error('[addShoppingItem]', error); return null; }
  return mapItem(data as ShoppingRow);
}

export function updateShoppingItem(id: string, fields: { title: string; category: ShoppingCategory; notes: string | null }) {
  return supabase.from('shopping_list_items').update(fields).eq('id', id);
}

export function deleteShoppingItem(id: string) {
  return supabase.from('shopping_list_items').delete().eq('id', id);
}

// ── The item's photo, shaped for ImageEditor (kind="shopping") ───────────────
// One photo, stored on the row. The "image id" ImageEditor passes around is
// the item's own id.

export async function fetchShoppingItemImages(itemId: string): Promise<EditableImage[]> {
  const { data } = await supabase.from('shopping_list_items')
    .select('image_path').eq('id', itemId).maybeSingle();
  const path = (data as { image_path: string | null } | null)?.image_path ?? null;
  const url = modelImageUrl(path);
  return url ? [{ id: itemId, url, isPrimary: true, imagePath: path }] : [];
}

/** Upload a photo and point the item at it, replacing any earlier one. */
export async function uploadShoppingItemImage(itemId: string, userId: string, file: File): Promise<{ error: string | null }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: upErr } = await supabase.storage.from('model-images')
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) return { error: upErr.message };
  const { error } = await supabase.from('shopping_list_items').update({ image_path: path }).eq('id', itemId);
  return { error: error?.message ?? null };
}

/** Clear the item's photo. The storage object is left in place (see the
 *  surgical-deletes rule), as with every other photo removal. */
export function removeShoppingItemImage(itemId: string) {
  return supabase.from('shopping_list_items').update({ image_path: null }).eq('id', itemId);
}
