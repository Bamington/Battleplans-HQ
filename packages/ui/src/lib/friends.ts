/**
 * friends.ts — client wrapper over the friendship RPCs and views
 *
 * Reads go through two views, writes go through SECURITY DEFINER functions.
 * That split is deliberate: RLS can't police a state transition (it cannot see
 * the old row and the new one together), so the database refuses direct writes
 * to `friendships` and the functions decide who may do what. See
 * 20260722030000_friendships.sql.
 *
 * NAMING, as everywhere in this feature: `handle` is the column, but users see
 * it labelled "Username". `username` is the private "Your Name". See the note
 * at the top of lib/handles.ts.
 */

import { supabase } from './supabase'
import { avatarUrl } from './avatars'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Friend {
  friendshipId: string
  /** The friend's user id. */
  id: string
  /** Public @username. */
  handle: string
  /** Their private "Your Name" — visible because you are friends. */
  username: string | null
  avatarUrl: string | null
  createdAt: string
  respondedAt: string | null
}

export interface FriendRequest {
  friendshipId: string
  id: string
  handle: string
  /** Deliberately no `username`: a pending request must not reveal a real name. */
  avatarUrl: string | null
  direction: 'incoming' | 'outgoing'
  createdAt: string
}

export interface PublicProfile {
  id: string
  handle: string
  avatarUrl: string | null
}

// ── Errors ───────────────────────────────────────────────────────────────────

/**
 * SQLSTATEs our own functions raise deliberately. Anything else is a real
 * fault, and its message is not something to show a user.
 */
const INTENTIONAL_ERROR_CODES = new Set(['42501', 'P0002', '22023', '23505'])

function describeError(error: { code?: string; message: string } | null): string | null {
  if (!error) return null
  if (error.code && INTENTIONAL_ERROR_CODES.has(error.code)) return error.message
  return 'Something went wrong. Please try again.'
}

/** Throws with a message safe to display. */
function raise(error: { code?: string; message: string }): never {
  throw new Error(describeError(error) ?? 'Something went wrong. Please try again.')
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function listFriends(): Promise<Friend[]> {
  const { data, error } = await supabase
    .from('my_friends')
    .select('friendship_id, id, handle, username, avatar_path, created_at, responded_at')
    .order('username', { nullsFirst: false })

  if (error) raise(error)
  return (data ?? []).map((r) => ({
    friendshipId: r.friendship_id as string,
    id:          r.id as string,
    handle:      r.handle as string,
    username:    (r.username as string | null) ?? null,
    avatarUrl:   avatarUrl(r.avatar_path as string | null),
    createdAt:   r.created_at as string,
    respondedAt: (r.responded_at as string | null) ?? null,
  }))
}

export async function listFriendRequests(): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('my_friend_requests')
    .select('friendship_id, id, handle, avatar_path, direction, created_at')
    .order('created_at', { ascending: false })

  if (error) raise(error)
  return (data ?? []).map((r) => ({
    friendshipId: r.friendship_id as string,
    id:        r.id as string,
    handle:    r.handle as string,
    avatarUrl: avatarUrl(r.avatar_path as string | null),
    direction: r.direction as 'incoming' | 'outgoing',
    createdAt: r.created_at as string,
  }))
}

/**
 * Look up someone by their @username, so the UI can show who it's about to add.
 *
 * Returns null when there's no match. Note this reads `public_profiles`, which
 * cannot see whether that person has blocked you — only send_friend_request
 * knows, and it deliberately reports a block as "no such user".
 */
export async function findProfileByHandle(handle: string): Promise<PublicProfile | null> {
  const trimmed = handle.trim().replace(/^@/, '')
  if (!trimmed) return null

  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, handle, avatar_path')
    .ilike('handle', trimmed)
    .limit(1)
    .maybeSingle()

  if (error) raise(error)
  if (!data) return null
  return {
    id:        data.id as string,
    handle:    data.handle as string,
    avatarUrl: avatarUrl(data.avatar_path as string | null),
  }
}

// ── Writes ───────────────────────────────────────────────────────────────────

/** Send a request by @username. Returns the friendship id. */
export async function sendFriendRequest(handle: string): Promise<string> {
  const { data, error } = await supabase.rpc('send_friend_request', {
    target_handle: handle.trim().replace(/^@/, ''),
  })
  if (error) raise(error)
  return data as string
}

/** Accept or decline. Only the person who RECEIVED the request may call this. */
export async function respondToFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_to_friend_request', {
    friendship: friendshipId,
    accept,
  })
  if (error) raise(error)
}

/**
 * Unfriend, or withdraw a request you sent — both are just removing the row.
 * Allowed by RLS for either party, except on a blocked row.
 */
export async function removeFriendship(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  if (error) raise(error)
}

export async function blockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { other_user: userId })
  if (error) raise(error)
}

export async function unblockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('unblock_user', { other_user: userId })
  if (error) raise(error)
}
