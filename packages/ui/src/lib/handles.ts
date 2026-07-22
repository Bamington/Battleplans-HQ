/**
 * handles.ts — @handle validation and availability
 *
 * A handle is the unique, lowercase identifier used to find a user (friend
 * search, and later their public page). It is deliberately separate from
 * `username`, which is a free display name and may repeat.
 *
 * The rules here MUST stay in step with the check constraint in
 * 20260722000000_user_handles.sql — the database is the real authority, and a
 * client that allows something the constraint rejects just produces a confusing
 * save error.
 */

import { supabase } from './supabase'

/** 3–24 chars, lowercase alphanumeric plus _ and -, starting alphanumeric. */
export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,23}$/

export const HANDLE_MAX_LENGTH = 24

/**
 * Coerce user input toward a legal handle as they type: lowercase, spaces to
 * hyphens, illegal characters dropped, and any leading - or _ removed since the
 * first character must be alphanumeric.
 *
 * Deliberately does NOT pad to the minimum length — that would fight the user
 * mid-typing. So the result can still be too SHORT to be valid, but never
 * contains an illegal character or a bad first character.
 */
export function normaliseHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[_-]+/, '')
    .slice(0, HANDLE_MAX_LENGTH)
}

/** Human-readable reason the handle is invalid, or null when it's fine. */
export function validateHandle(handle: string): string | null {
  if (!handle) return 'Please choose a handle.'
  if (handle.length < 3) return 'Handles need at least 3 characters.'
  if (handle.length > HANDLE_MAX_LENGTH) return `Handles can be at most ${HANDLE_MAX_LENGTH} characters.`
  if (!/^[a-z0-9]/.test(handle)) return 'Handles must start with a letter or number.'
  if (!HANDLE_PATTERN.test(handle)) return 'Handles can only use letters, numbers, - and _.'
  return null
}

/**
 * Turn a profile-save failure into something a person can act on.
 *
 * The availability check is advisory and racy — two people can pass it with the
 * same handle and only one wins at the unique index. That loser must not be
 * shown a raw Postgres constraint message.
 */
export function describeProfileSaveError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'That handle was just taken. Please choose another.'
  if (error.code === '23514') return 'That handle isn’t valid. Use 3–24 letters, numbers, - or _.'
  return error.message
}

/**
 * Is this handle free? Reads `public_profiles`, the sanctioned cross-user view.
 *
 * `selfId` excludes the caller's own row so re-saving your existing handle
 * doesn't report itself as taken.
 *
 * Returns true on a query error: a transient network failure shouldn't block
 * someone from submitting. The unique index is the real guarantee — this check
 * only exists to catch the common case before the user hits Save.
 */
export async function isHandleAvailable(handle: string, selfId: string | null): Promise<boolean> {
  const { data, error } = await supabase
    .from('public_profiles')
    .select('id')
    .ilike('handle', handle)
    .limit(1)

  if (error) return true
  return !data?.some((row) => row.id !== selfId)
}
