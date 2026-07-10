import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** A published release note, as shown in an app's "News & Updates" panel. */
export interface AppUpdate {
  id:                string;
  title:             string;
  body:              string | null;
  version:           string | null;
  /** Author's name, snapshotted when the update was published. */
  published_by_name: string | null;
  published_at:      string | null;
}

/** The apps an update can be tagged against (public.updates.apps). */
export type UpdateApp = 'battlecards' | 'battleplan' | 'battlepack' | 'battlebox';

/**
 * Returns every published update tagged for `app`, newest first.
 *
 * An update with an empty `apps` array is tagged for no app and never appears —
 * each app only sees updates that explicitly name it.
 */
export function useUpdates(app: UpdateApp) {
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    supabase
      .from('updates')
      .select('id, title, body, version, published_by_name, published_at')
      .eq('published', true)
      .contains('apps', [app])           // apps @> '{app}' — hits the GIN index
      .order('published_at', { ascending: false, nullsFirst: false })
      .then(({ data }) => {
        if (cancelled) return;
        setUpdates((data as AppUpdate[] | null) ?? []);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [app]);

  return { updates, loading };
}
