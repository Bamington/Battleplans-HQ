/**
 * useSelectedVenue — which venue you are currently looking at, across screens.
 *
 * Home, Manage Store and Store Stats each used to keep their own `useState`
 * and default to the first venue in their own list. So choosing Store C on the
 * home screen and clicking Manage Store landed you on Store A, and coming back
 * put you on C again — the app forgetting something you had just told it,
 * twice per trip.
 *
 * ── null is not the same as '' ───────────────────────────────────────────
 *
 * '' means "Your Profile", which is a real choice on the home screen and one
 * worth keeping. `null` means nothing has been chosen yet, and is what lets a
 * first-time load fall through to a sensible default instead of opening on the
 * personal view forever. `localStorage.getItem` distinguishes them for free:
 * absent reads as null, a stored empty string reads as ''.
 *
 * ── Why localStorage and not context ─────────────────────────────────────
 *
 * These are separate routes, so a provider would have to live above the router
 * and every page would still need to read from it. Storage gets the same
 * result with no wiring, and survives a reload as a bonus — which is what you
 * want from "the venue I'm working on today". Nothing syncs across devices,
 * which is correct: this is a per-browser convenience, not a preference.
 *
 * The venue a page can honour is not always the one stored — Manage Store is
 * admin-only, so a venue you merely work at cannot be opened there. Each page
 * checks the stored id against its OWN list and falls back without writing,
 * so a fallback never overwrites the choice you actually made.
 */

import { useCallback, useState } from 'react';

const KEY = 'battleplan:selected-venue';

export function useSelectedVenue(): [string | null, (id: string) => void] {
  const [venueId, setVenueId] = useState<string | null>(() => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  });

  const select = useCallback((id: string) => {
    setVenueId(id);
    try { localStorage.setItem(KEY, id); } catch { /* private mode / quota */ }
  }, []);

  return [venueId, select];
}

/**
 * The stored venue if this page can show it, else the first one it can.
 *
 * Returns '' when there is nothing to show at all, which every caller already
 * treats as "no venue".
 */
export function resolveVenue(stored: string | null, available: { id: string }[]): string {
  if (available.length === 0) return '';
  if (stored && available.some(l => l.id === stored)) return stored;
  return available[0].id;
}
