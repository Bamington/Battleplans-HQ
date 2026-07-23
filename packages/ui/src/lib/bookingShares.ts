/**
 * bookingShares.ts — client wrapper over the booking-sharing RPCs and views
 *
 * Reads go through two views (my_incoming_booking_shares /
 * my_outgoing_booking_shares); writes go through SECURITY DEFINER functions.
 * Same split, and same reasoning, as friends.ts: RLS can't police a state
 * transition, so the database refuses direct writes and the functions decide
 * who may do what. See 20260723030000_booking_shares.sql.
 *
 * The incoming view deliberately carries the sharer's handle + avatar but NOT
 * their private "Your Name" — that stays hidden until you're friends.
 */

import { supabase } from './supabase'
import { avatarUrl } from './avatars'

// ── Types ────────────────────────────────────────────────────────────────────

export type BookingShareStatus = 'pending' | 'accepted' | 'declined'

export interface IncomingBookingShare {
  shareId: string
  status: BookingShareStatus
  createdAt: string
  respondedAt: string | null
  bookingId: string
  date: string
  locationId: string | null
  locationName: string | null
  timeslotName: string | null
  timeslotStart: string | null
  timeslotEnd: string | null
  gameId: string | null
  gameName: string | null
  gameSlug: string | null
  /** The person who shared it — public identity only, never their real name. */
  sharer: { id: string; handle: string; avatarUrl: string | null }
}

export interface OutgoingBookingShare {
  shareId: string
  status: BookingShareStatus
  createdAt: string
  respondedAt: string | null
  bookingId: string
  recipient: { id: string; handle: string; avatarUrl: string | null }
}

// ── Errors ───────────────────────────────────────────────────────────────────

const INTENTIONAL_ERROR_CODES = new Set(['42501', 'P0002', '22023', '23505'])

function raise(error: { code?: string; message: string }): never {
  const msg = error.code && INTENTIONAL_ERROR_CODES.has(error.code)
    ? error.message
    : 'Something went wrong. Please try again.'
  throw new Error(msg)
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function listIncomingBookingShares(): Promise<IncomingBookingShare[]> {
  const { data, error } = await supabase
    .from('my_incoming_booking_shares')
    .select('*')
    .order('date', { ascending: true })

  if (error) raise(error)
  return (data ?? []).map((r) => ({
    shareId:       r.share_id as string,
    status:        r.status as BookingShareStatus,
    createdAt:     r.created_at as string,
    respondedAt:   (r.responded_at as string | null) ?? null,
    bookingId:     r.booking_id as string,
    date:          r.date as string,
    locationId:    (r.location_id as string | null) ?? null,
    locationName:  (r.location_name as string | null) ?? null,
    timeslotName:  (r.timeslot_name as string | null) ?? null,
    timeslotStart: (r.timeslot_start_time as string | null) ?? null,
    timeslotEnd:   (r.timeslot_end_time as string | null) ?? null,
    gameId:        (r.game_id as string | null) ?? null,
    gameName:      (r.game_name as string | null) ?? null,
    gameSlug:      (r.game_slug as string | null) ?? null,
    sharer: {
      id:        r.sharer_id as string,
      handle:    r.sharer_handle as string,
      avatarUrl: avatarUrl(r.sharer_avatar_path as string | null),
    },
  }))
}

export async function listOutgoingBookingShares(): Promise<OutgoingBookingShare[]> {
  const { data, error } = await supabase
    .from('my_outgoing_booking_shares')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) raise(error)
  return (data ?? []).map((r) => ({
    shareId:     r.share_id as string,
    status:      r.status as BookingShareStatus,
    createdAt:   r.created_at as string,
    respondedAt: (r.responded_at as string | null) ?? null,
    bookingId:   r.booking_id as string,
    recipient: {
      id:        r.recipient_id as string,
      handle:    r.recipient_handle as string,
      avatarUrl: avatarUrl(r.recipient_avatar_path as string | null),
    },
  }))
}

// ── Writes ───────────────────────────────────────────────────────────────────

/** Share a booking you own with a user, by @username. Returns the share id. */
export async function shareBooking(bookingId: string, handle: string): Promise<string> {
  const { data, error } = await supabase.rpc('share_booking', {
    booking: bookingId,
    target_handle: handle.trim().replace(/^@/, ''),
  })
  if (error) raise(error)
  return data as string
}

/** Accept or decline a booking shared with you. Recipient only. */
export async function respondToBookingShare(shareId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_to_booking_share', {
    share: shareId,
    accept,
  })
  if (error) raise(error)
}

/** Withdraw a share you sent — allowed by RLS for the sharer only. */
export async function withdrawBookingShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('booking_shares').delete().eq('id', shareId)
  if (error) raise(error)
}
