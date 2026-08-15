/**
 * useAdminLocations — the venues the signed-in user administers.
 *
 * "Store admin" is membership of a location's `admins` array, not a role on the
 * profile, so this is the only way to answer "which shops is this person staff
 * at". BattlePack gates its whole app on the answer being non-empty; BattlePlan
 * uses it to offer the store view.
 *
 * NOTE ON DUPLICATION: BattlePlan carries its own copy in
 * src/hooks/useBookingData.ts. This shared one was added when BattlePack needed
 * the same thing. That copy is left alone deliberately — it works, and rewiring
 * a shipped app was not part of the change that created this — but it should be
 * pointed here and deleted.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface AdminLocation {
  id: string;
  name: string;
  icon: string | null;
  address: string | null;
}

export interface UseAdminLocations {
  locations: AdminLocation[];
  /** True until the first result for this user is known. */
  loading: boolean;
  /** Whether they administer anything at all. False while loading. */
  isStoreAdmin: boolean;
}

export function useAdminLocations(userId: string | null): UseAdminLocations {
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  // Which user the current list belongs to. `loading` is derived from this
  // rather than set asynchronously, so it is never stale within a render: the
  // moment userId changes, loading flips true until that fetch resolves.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) { setLocations([]); setLoadedFor(null); return; }

    supabase
      .from('locations')
      .select('id, name, icon, address')
      .contains('admins', [userId])
      // A space is a borrowed room, not an organisation you administer.
      .neq('kind', 'space')
      .order('name')
      .then(({ data }) => {
        if (cancelled) return;
        setLocations((data ?? []) as AdminLocation[]);
        setLoadedFor(userId);
      });

    return () => { cancelled = true; };
  }, [userId]);

  const loading = !!userId && loadedFor !== userId;

  return { locations, loading, isStoreAdmin: !loading && locations.length > 0 };
}
