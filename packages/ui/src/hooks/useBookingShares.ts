/**
 * useBookingShares.ts — incoming + outgoing booking shares, and the actions
 *
 * One hook over both directions, like useFriends, because the actions cross
 * them: accepting an incoming share and withdrawing an outgoing one both change
 * what the bookings column and the owner modal show. Actions re-read from the
 * server rather than patching local state — the lists are small and the server
 * is the source of truth.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listIncomingBookingShares,
  listOutgoingBookingShares,
  shareBooking,
  respondToBookingShare,
  withdrawBookingShare,
  type IncomingBookingShare,
  type OutgoingBookingShare,
} from '../lib/bookingShares'

export interface UseBookingShares {
  /** Bookings shared WITH me (pending + accepted). */
  incoming: IncomingBookingShare[]
  /** Everyone I've shared any of my bookings with. Filter by bookingId as needed. */
  outgoing: OutgoingBookingShare[]
  loading: boolean
  busy: boolean
  error: string | null
  clearError: () => void
  refresh: () => Promise<void>
  /** Share a booking I own with a @username. */
  share: (bookingId: string, handle: string) => Promise<boolean>
  /** Accept or decline a booking shared with me. */
  respond: (shareId: string, accept: boolean) => Promise<boolean>
  /** Withdraw a share I sent. */
  withdraw: (shareId: string) => Promise<boolean>
  /** Leave a booking I accepted an invite to (same delete, invitee side). */
  leave: (shareId: string) => Promise<boolean>
}

export function useBookingShares(): UseBookingShares {
  const [incoming, setIncoming] = useState<IncomingBookingShare[]>([])
  const [outgoing, setOutgoing] = useState<OutgoingBookingShare[]>([])
  const [loading,  setLoading]  = useState(true)
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const aliveRef  = useRef(true)
  const loadIdRef = useRef(0)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const refresh = useCallback(async () => {
    const loadId = ++loadIdRef.current
    try {
      const [inc, out] = await Promise.all([listIncomingBookingShares(), listOutgoingBookingShares()])
      if (!aliveRef.current || loadId !== loadIdRef.current) return
      setIncoming(inc)
      setOutgoing(out)
    } catch (err) {
      if (!aliveRef.current || loadId !== loadIdRef.current) return
      setError(err instanceof Error ? err.message : 'Could not load your invitations.')
    } finally {
      if (aliveRef.current && loadId === loadIdRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const run = useCallback(async (fn: () => Promise<unknown>): Promise<boolean> => {
    setError(null)
    setBusy(true)
    try {
      await fn()
      await refresh()
      return true
    } catch (err) {
      if (aliveRef.current) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
      return false
    } finally {
      if (aliveRef.current) setBusy(false)
    }
  }, [refresh])

  return {
    incoming,
    outgoing,
    loading,
    busy,
    error,
    clearError: useCallback(() => setError(null), []),
    refresh,
    share:    useCallback((bookingId: string, handle: string) => run(() => shareBooking(bookingId, handle)), [run]),
    respond:  useCallback((shareId: string, accept: boolean) => run(() => respondToBookingShare(shareId, accept)), [run]),
    withdraw: useCallback((shareId: string) => run(() => withdrawBookingShare(shareId)), [run]),
    leave:    useCallback((shareId: string) => run(() => withdrawBookingShare(shareId)), [run]),
  }
}
