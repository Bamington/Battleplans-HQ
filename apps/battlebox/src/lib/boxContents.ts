/**
 * boxContents.ts — "What's in this box?" Suggests the models that come in a
 * boxed product, via the `box-contents` Edge Function (Brave web search read by
 * Claude Haiku, answers shared by everyone in box_contents). Also the admin
 * side: listing, correcting and deleting stored answers.
 */

import { supabase } from '@battleplans/ui';

export interface BoxItem {
  name: string;
  count: number;
}

export interface BoxSource {
  title: string;
  url: string;
}

export interface BoxLookup {
  /** False when the lookup ran but nothing believable came back. */
  found: boolean;
  items: BoxItem[];
  sources: BoxSource[];
}

/** Look up a box's contents. `error` is a sentence fit to show the user. */
export async function lookupBoxContents(name: string, gameId: string | null): Promise<{ result: BoxLookup | null; error: string | null }> {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${url}/functions/v1/box-contents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? anon}`,
        'apikey': anon,
      },
      body: JSON.stringify({ action: 'lookup', name, game_id: gameId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { result: null, error: res.status === 503 ? 'Box suggestions aren’t switched on yet.' : (body.error ?? 'Couldn’t look this box up. Please try again.') };
    }
    return { result: { found: !!body.found, items: body.items ?? [], sources: body.sources ?? [] }, error: null };
  } catch {
    return { result: null, error: 'Couldn’t look this box up. Check your connection and try again.' };
  }
}

/** Loose name match for spotting a suggestion the user already owns. */
export const normaliseModelName = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface BoxContentsRow {
  id: string;
  box_name: string;
  game_id: string | null;
  game_name: string | null;
  items: BoxItem[];
  sources: BoxSource[];
  found: boolean;
  fetched_at: string;
  edited_at: string | null;
}

/** Every stored answer, most recent first (admins only — RLS). */
export async function fetchBoxContentsRows(): Promise<BoxContentsRow[]> {
  const { data, error } = await supabase.from('box_contents')
    .select('id, box_name, game_id, game_name, items, sources, found, fetched_at, edited_at')
    .order('fetched_at', { ascending: false });
  if (error) throw error;
  return (data as BoxContentsRow[]) ?? [];
}

/** Save an admin's correction. Marking it edited locks it against re-lookups. */
export async function saveBoxContents(id: string, items: BoxItem[], userId: string | null): Promise<{ error: string | null }> {
  const clean = items
    .map(i => ({ name: i.name.replace(/\s+/g, ' ').trim(), count: Math.max(1, Math.round(i.count) || 1) }))
    .filter(i => i.name);
  const { error } = await supabase.from('box_contents').update({
    items: clean,
    found: clean.length > 0,
    edited_at: new Date().toISOString(),
    edited_by: userId,
  }).eq('id', id);
  return { error: error?.message ?? null };
}

/** Forget a stored answer, so the next lookup searches again. */
export async function deleteBoxContents(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('box_contents').delete().eq('id', id);
  return { error: error?.message ?? null };
}
