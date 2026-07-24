/**
 * useFriends.ts — friends list, pending requests, and the actions on them
 *
 * One hook rather than several, because every action changes both lists:
 * accepting a request removes it from `requests` AND adds to `friends`, and a
 * mutual request turns into a friendship without ever being answered. Splitting
 * them would mean two refreshes and a visible half-updated state.
 *
 * Actions re-read from the server instead of patching local state. These lists
 * are small and the server is the only thing that knows the real outcome — a
 * request you send can come back already accepted if the other person had
 * requested you first.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  listFriends,
  listFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriendship,
  blockUser,
  unblockUser,
  type Friend,
  type FriendRequest,
} from '../lib/friends'

export interface UseFriends {
  friends: Friend[]
  /** Requests waiting on YOU to answer. */
  incoming: FriendRequest[]
  /** Requests you've sent that haven't been answered. */
  outgoing: FriendRequest[]
  loading: boolean
  /** Last failure, safe to display. Cleared when the next action starts. */
  error: string | null
  /** True while an action is in flight, for disabling buttons. */
  busy: boolean
  /**
   * Drop the current error. Needed because one hook instance is shared by the
   * list and its dialogs — without this, a failed send stays on screen behind
   * the dialog that caused it.
   */
  clearError: () => void
  refresh: () => Promise<void>
  /** Send by @username. Resolves true on success, false if it failed. */
  sendRequest: (handle: string) => Promise<boolean>
  respond: (friendshipId: string, accept: boolean) => Promise<boolean>
  /** Unfriend, or withdraw a request you sent. */
  remove: (friendshipId: string) => Promise<boolean>
  block: (userId: string) => Promise<boolean>
  unblock: (userId: string) => Promise<boolean>
}

export function useFriends(): UseFriends {
  const [friends,  setFriends]  = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loading,  setLoading]  = useState(true)
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // Guards against setting state after unmount, and against a slow first load
  // overwriting the result of an action that finished sooner.
  const aliveRef = useRef(true)
  const loadIdRef = useRef(0)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const refresh = useCallback(async () => {
    const loadId = ++loadIdRef.current
    try {
      const [f, r] = await Promise.all([listFriends(), listFriendRequests()])
      if (!aliveRef.current || loadId !== loadIdRef.current) return
      setFriends(f)
      setRequests(r)
    } catch (err) {
      if (!aliveRef.current || loadId !== loadIdRef.current) return
      setError(err instanceof Error ? err.message : 'Could not load your friends.')
    } finally {
      if (aliveRef.current && loadId === loadIdRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  /** Every action shares this shape: clear the error, run, re-read, report. */
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

  const incoming = useMemo(() => requests.filter(r => r.direction === 'incoming'), [requests])
  const outgoing = useMemo(() => requests.filter(r => r.direction === 'outgoing'), [requests])

  return {
    friends,
    incoming,
    outgoing,
    loading,
    error,
    busy,
    clearError: useCallback(() => setError(null), []),
    refresh,
    sendRequest: useCallback((handle: string) => run(() => sendFriendRequest(handle)), [run]),
    respond:     useCallback((id: string, accept: boolean) => run(() => respondToFriendRequest(id, accept)), [run]),
    remove:      useCallback((id: string) => run(() => removeFriendship(id)), [run]),
    block:       useCallback((userId: string) => run(() => blockUser(userId)), [run]),
    unblock:     useCallback((userId: string) => run(() => unblockUser(userId)), [run]),
  }
}
