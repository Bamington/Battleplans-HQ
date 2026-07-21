/**
 * avatars.ts — Profile picture storage helpers
 *
 * `user_profiles.avatar_path` holds a bucket object key, not a full URL (the
 * same convention as model_images / box_images / battle_images), so the public
 * URL is resolved at read time and a project move needs no data migration.
 */

import { supabase } from './supabase'

const AVATAR_BUCKET = 'avatars'

/**
 * Resolve a stored `avatar_path` to a public URL. Returns null for a missing
 * path so callers can fall through to initials.
 */
export function avatarUrl(path?: string | null): string | null {
  if (!path) return null
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * Upload a cropped avatar and return its object key.
 *
 * The key is always '{uid}/…' — the bucket's RLS policy checks that first path
 * segment against auth.uid(), so uploads outside your own folder are rejected.
 * Each upload gets a fresh filename rather than overwriting: it sidesteps CDN
 * caching of a stale image, and the previous object is left in place (per the
 * project's surgical-deletes rule) rather than blind-deleted.
 */
export async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })

  if (error) throw error
  return path
}
