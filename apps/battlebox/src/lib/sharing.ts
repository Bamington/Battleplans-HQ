/**
 * sharing.ts — Share links for models, collections (boxes) and recipes.
 *
 * Two tiers, one setting per item:
 *   'none'   — not shared: no link, public off
 *   'link'   — "Anyone with the link": a share_links row (random code)
 *   'public' — a link AND the item's `public` flag (for a future search)
 *
 * The public page reads a shared item only through get_shared_item(code),
 * which returns the item and everything inside it — minus purchase dates.
 * See migration 20261019120000_sharing.sql.
 */

import { supabase } from '@battleplans/ui';

export type ShareKind = 'model' | 'box' | 'recipe';
export type ShareLevel = 'none' | 'link' | 'public';

/** The table each kind lives in (for its `public` flag). */
const TABLE: Record<ShareKind, string> = { model: 'models', box: 'boxes', recipe: 'recipes' };

/**
 * Where share links point. Always the real site, except on a web preview
 * (*.vercel.app / localhost), where the preview's own address is used so the
 * link works there too. The native app runs from capacitor://, so it can't
 * use its own origin.
 */
export function shareUrl(token: string): string {
  const { protocol, host, origin } = window.location;
  const isWebPreview = protocol.startsWith('http') && (host.endsWith('.vercel.app') || host.startsWith('localhost'));
  return `${isWebPreview ? origin : 'https://battlebench.app'}/s/${token}`;
}

export interface ShareState { level: ShareLevel; token: string | null }

/** An item's current sharing setting. */
export async function fetchShareState(kind: ShareKind, itemId: string): Promise<ShareState> {
  const [{ data: link }, { data: row }] = await Promise.all([
    supabase.from('share_links').select('token').eq('kind', kind).eq('item_id', itemId).maybeSingle(),
    supabase.from(TABLE[kind]).select('public').eq('id', itemId).maybeSingle(),
  ]);
  const token = (link as { token: string } | null)?.token ?? null;
  const isPublic = !!(row as { public: boolean } | null)?.public;
  // Public without a link happens for items marked public by the old app —
  // they're still public; a link is made the first time it's needed.
  return { level: isPublic ? 'public' : token ? 'link' : 'none', token };
}

/** The item's link code, creating it if there isn't one yet. */
async function ensureLink(kind: ShareKind, itemId: string): Promise<{ token: string | null; error: string | null }> {
  const { data: existing } = await supabase.from('share_links').select('token')
    .eq('kind', kind).eq('item_id', itemId).maybeSingle();
  if (existing) return { token: (existing as { token: string }).token, error: null };
  const { data, error } = await supabase.from('share_links')
    .insert({ kind, item_id: itemId }).select('token').single();
  return { token: (data as { token: string } | null)?.token ?? null, error: error?.message ?? null };
}

/** Change an item's sharing. Returns the resulting state. */
export async function setShareLevel(kind: ShareKind, itemId: string, level: ShareLevel): Promise<{ state: ShareState | null; error: string | null }> {
  if (level === 'none') {
    // Turning sharing off deletes the link for good — sharing again makes a new one.
    const { error: delErr } = await supabase.from('share_links').delete().eq('kind', kind).eq('item_id', itemId);
    if (delErr) return { state: null, error: delErr.message };
    const { error } = await supabase.from(TABLE[kind]).update({ public: false }).eq('id', itemId);
    return { state: error ? null : { level: 'none', token: null }, error: error?.message ?? null };
  }
  const { token, error: linkErr } = await ensureLink(kind, itemId);
  if (linkErr || !token) return { state: null, error: linkErr ?? 'Could not create the link.' };
  const { error } = await supabase.from(TABLE[kind]).update({ public: level === 'public' }).eq('id', itemId);
  return { state: error ? null : { level, token }, error: error?.message ?? null };
}

// ── The public page ──────────────────────────────────────────────────────────

export interface SharedPaint { name: string; brand: string; type: string; swatch: string | null; note: string | null }
export interface SharedImage {
  image_path: string | null; image_url?: string | null;
  is_primary: boolean; display_order: number; is_progress?: boolean; created_at?: string | null;
}
export interface SharedRecipe { id: string; name: string; description: string | null; paints: SharedPaint[]; images: SharedImage[] }
export interface SharedModel {
  id: string; name: string; status: string; count: number;
  painted_date: string | null; started_painting_date: string | null; on_desk: boolean;
  painting_notes: string | null; lore_name: string | null; lore_description: string | null;
  image_path: string | null; game: { name: string; slug: string } | null;
  images: SharedImage[]; recipes: SharedRecipe[]; direct_paints: SharedPaint[];
  included_in: { name: string; type: string }[];
}
export interface SharedBox {
  id: string; name: string; type: string; includes_string: string | null;
  game: { name: string; slug: string } | null; images: SharedImage[]; models: SharedModel[];
}

export type SharedItem =
  | { kind: 'model'; item: SharedModel }
  | { kind: 'box'; item: SharedBox }
  | { kind: 'recipe'; item: SharedRecipe };

export type SharedPayload = SharedItem & {
  public: boolean;
  owner: { id: string; handle: string | null; avatar_path: string | null } | null;
};

/** A shared item by its link code, or null if the link doesn't exist (any more). */
export async function getSharedItem(token: string): Promise<SharedPayload | null> {
  const { data, error } = await supabase.rpc('get_shared_item', { p_token: token });
  if (error || !data || !(data as { item: unknown }).item) return null;
  return data as SharedPayload;
}
