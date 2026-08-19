/**
 * shareClient.ts — reading and copying a deck shared by link
 *
 * A shared deck belongs to someone else, so the app's normal Supabase client
 * can't see it: every policy on decks and its children is scoped to the signed
 * in owner. Rather than mirror the whole deck behind a bespoke payload
 * function, migration_deck_sharing.sql widens RLS for exactly one deck — the
 * one whose share token the caller can produce — and expects that token on the
 * `x-share-token` request header.
 *
 * So this module hands back a *second* Supabase client, identical to the normal
 * one except that it pins that header. Every existing query then works against
 * a shared deck unchanged, which is what lets the read-only view reuse the same
 * loaders the rest of the app uses.
 *
 * WHY IT SETS Authorization BY HAND
 * The share client deliberately holds no session of its own — a second GoTrue
 * instance writing to the same storage races the real one and signs people out.
 * When a signed-in visitor copies a deck, though, the request has to be BOTH
 * authenticated (to write into their own storage prefix) and token-bearing (to
 * read the sharer's objects). Passing the caller's access token straight
 * through as a header gets both without a second session.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@battleplans/ui';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Path prefix Supabase storage uses for card art — see migration_card_images.sql. */
const CARD_IMAGE_BUCKET = 'card-images';

/**
 * A Supabase client scoped to one shared deck.
 *
 * @param token       the deck's share token, from the /d/:token URL
 * @param accessToken the viewer's access token, when they're signed in. Omit
 *                    for an anonymous visitor — they can still read the deck,
 *                    they just can't copy it.
 */
export function createShareClient(token: string, accessToken?: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // This client is a read path for someone else's deck. It must never
      // touch the session the real client owns.
      persistSession:     false,
      autoRefreshToken:   false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-share-token': token,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    },
  });
}

// ── Shared deck header ───────────────────────────────────────────────────────

export interface SharedDeckMeta {
  deckId:    string;
  name:      string;
  gameSlug:  string;
  /** The sharer. Display name falls back to null rather than an email — the
   *  share policy on profiles exposes display_name and avatar_url only. */
  ownerName:      string | null;
  ownerAvatarUrl: string | null;
}

/**
 * Resolve a share token to the deck it unlocks, along with the sharer's public
 * profile. Returns null when the token is unknown or has been revoked — the
 * two are deliberately indistinguishable to the caller.
 */
export async function loadSharedDeckMeta(
  client: SupabaseClient,
): Promise<SharedDeckMeta | null> {
  const { data, error } = await client
    .from('decks')
    .select('id, name, user_id, games(slug), profiles(display_name, avatar_url)')
    .maybeSingle();

  if (error || !data) return null;

  // The header row is whatever the token unlocked; there is only ever one,
  // because current_share_deck_id() resolves to a single deck.
  // PostgREST types an embedded relation as an array; a to-one join returns a
  // single object, so the cast goes through unknown.
  const row = data as unknown as {
    id: string;
    name: string;
    games:    { slug: string } | null;
    profiles: { display_name: string | null; avatar_url: string | null } | null;
  };
  const game    = row.games;
  const profile = row.profiles;

  return {
    deckId:         row.id,
    name:           row.name,
    gameSlug:       game?.slug ?? '',
    ownerName:      profile?.display_name ?? null,
    ownerAvatarUrl: profile?.avatar_url ?? null,
  };
}

// ── Copying a shared deck ────────────────────────────────────────────────────

interface CopiedImage {
  source_path: string;
  card_id:     string;
  image_type:  string | null;
  sort_order:  number | null;
}

/**
 * Copy a shared deck into the signed-in user's own decks and return the new
 * deck's id.
 *
 * The row cloning happens server-side in copy_shared_deck — it has to, since
 * the source rows belong to another user. Storage objects can't be copied from
 * SQL, so the function reports the portrait paths it couldn't bring across and
 * they're cloned here, mirroring how duplicateDeck.ts handles the same problem.
 *
 * A portrait that fails to copy is logged and skipped rather than failing the
 * whole copy: the user would much rather have the deck with a missing picture
 * than no deck at all. This matches the existing duplicate behaviour.
 */
export async function copySharedDeck(token: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const client = createShareClient(token, session.access_token);

  const { data, error } = await client.rpc('copy_shared_deck', { p_token: token });
  if (error) throw error;

  const result = data as { deck_id?: string; images?: CopiedImage[] } | null;

  const newDeckId = result?.deck_id;
  if (!newDeckId) throw new Error('Copy did not return a deck');

  const images = result.images ?? [];

  for (const img of images) {
    // A card whose clone didn't make it — nothing to hang the image on.
    if (!img.card_id) continue;

    try {
      const ext    = img.source_path.split('.').pop() ?? 'jpg';
      const prefix = img.image_type === 'avatar' ? 'avatar-' : '';
      const newPath = `${session.user.id}/${img.card_id}/${prefix}${crypto.randomUUID()}.${ext}`;

      // Copied through the share client: reading the sharer's object needs the
      // token header, writing into the caller's own prefix needs their auth.
      const { error: copyErr } = await client
        .storage.from(CARD_IMAGE_BUCKET)
        .copy(img.source_path, newPath);
      if (copyErr) throw copyErr;

      // The row, though, is the caller's own — normal client, normal policy.
      const { error: rowErr } = await supabase.from('card_images').insert({
        card_id:    img.card_id,
        file_path:  newPath,
        image_type: img.image_type,
        sort_order: img.sort_order,
      });
      if (rowErr) throw rowErr;
    } catch (err) {
      console.error('[BattleCards] Failed to copy a shared card image:', err);
    }
  }

  return newDeckId;
}

// ── Sharing your own deck ────────────────────────────────────────────────────

/** Absolute URL for a share token, for putting on the clipboard. */
export function shareUrlFor(token: string): string {
  return `${window.location.origin}/d/${token}`;
}

/**
 * Turn sharing on for a deck and return its link. Idempotent — a deck that's
 * already shared keeps the token it has, so reopening the share dialog never
 * invalidates a link the user has already sent someone.
 */
export async function shareDeck(deckId: string): Promise<string> {
  const { data, error } = await supabase.rpc('share_deck', { p_deck_id: deckId });
  if (error) throw error;
  return data as string;
}

/** Stop sharing a deck. Any link already handed out stops working immediately. */
export async function unshareDeck(deckId: string): Promise<void> {
  const { error } = await supabase.rpc('unshare_deck', { p_deck_id: deckId });
  if (error) throw error;
}
