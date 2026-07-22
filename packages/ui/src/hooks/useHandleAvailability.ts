/**
 * useHandleAvailability.ts — live "is this @username free?" check
 *
 * Naming: `handle` is the column; users see it labelled "Username". See the
 * note at the top of lib/handles.ts.
 *
 * Debounced so typing doesn't fire a query per keystroke, and guarded against
 * out-of-order responses: a slow reply for an earlier value must not overwrite
 * the verdict for what the user has since typed.
 *
 * The status is advisory. The unique index on user_profiles is the real
 * guarantee; this just avoids letting someone fill in a whole form only to be
 * rejected on save.
 */

import { useEffect, useRef, useState } from 'react'
import { isHandleAvailable, validateHandle } from '../lib/handles'

export type HandleStatus =
  | 'idle'      // nothing typed, or unchanged from the saved value
  | 'invalid'   // fails the format rules
  | 'checking'  // query in flight
  | 'available'
  | 'taken'

export interface HandleAvailability {
  status: HandleStatus
  /** Message to show under the field, or null when there's nothing to say. */
  message: string | null
}

const DEBOUNCE_MS = 400

/**
 * @param handle    current input value
 * @param selfId    the signed-in user's id, so their own handle isn't "taken"
 * @param original  the handle already saved — unchanged means nothing to check
 */
export function useHandleAvailability(
  handle: string,
  selfId: string | null,
  original?: string | null,
): HandleAvailability {
  const [status, setStatus] = useState<HandleStatus>('idle')
  // Bumped on every run so a stale response can tell it has been superseded.
  const runIdRef = useRef(0)

  useEffect(() => {
    const runId = ++runIdRef.current

    if (!handle || handle === original) { setStatus('idle'); return }

    const formatError = validateHandle(handle)
    if (formatError) { setStatus('invalid'); return }

    setStatus('checking')
    const timer = setTimeout(async () => {
      const free = await isHandleAvailable(handle, selfId)
      // A newer keystroke started another run — discard this verdict.
      if (runId !== runIdRef.current) return
      setStatus(free ? 'available' : 'taken')
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [handle, selfId, original])

  const message =
    status === 'invalid'   ? validateHandle(handle)
  : status === 'taken'     ? 'That username is already taken.'
  : status === 'available' ? 'That username is available.'
  : null

  return { status, message }
}
