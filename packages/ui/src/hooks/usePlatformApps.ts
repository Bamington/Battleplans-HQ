/**
 * usePlatformApps — the apps the signed-in user is allowed to open.
 *
 * Calls my_platform_apps(), which resolves the caller's role against the
 * platform_app_roles grants server-side. The client never sees apps it has no
 * access to, so the switcher can render the result directly.
 *
 * Returns entries shaped for <Navbar>, with the current app marked active.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCurrentApp } from '../lib/currentApp';
import { useImpersonatedRole } from '../lib/impersonation';
import type { AppEntry } from '../components/Navbar';

interface PlatformAppRow {
  slug: string;
  name: string;
  description: string | null;
  url: string;
  display_order: number;
  is_launched: boolean;
}

export interface UsePlatformAppsResult {
  /** Accessible apps, ordered, ready to hand to <Navbar>. */
  apps: AppEntry[];
  /** True until the first result (or a signed-out state) is known. */
  loading: boolean;
  /**
   * Whether the user may open the app this bundle is. null while loading.
   * False means they reached an app they have no grant for — e.g. by URL.
   */
  hasAccess: boolean | null;
}

export function usePlatformApps(): UsePlatformAppsResult {
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // Reactive: inside the HQ shell this changes as the user moves between apps,
  // and the switcher's "current" marker has to follow.
  const current = useCurrentApp();
  const impersonated = useImpersonatedRole();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // as_role is ignored server-side unless the caller is really an admin.
      const { data, error } = await supabase.rpc('my_platform_apps', {
        as_role: impersonated,
      });
      if (cancelled) return;

      if (error) {
        // Fail closed on the switcher rather than showing a wrong list.
        setApps([]);
        setLoading(false);
        return;
      }

      setApps(
        ((data ?? []) as PlatformAppRow[]).map((a) => ({
          slug: a.slug,
          name: a.name,
          description: a.description ?? undefined,
          // '#' is the Navbar's "coming soon" sentinel.
          href: a.is_launched ? a.url : '#',
          active: a.slug === current,
        }))
      );
      setLoading(false);
    }

    // onAuthStateChange fires immediately with INITIAL_SESSION once the
    // Supabase client has restored the session from storage. Using this
    // instead of getSession() avoids the race where getSession() is called
    // before the session is fully hydrated and returns null.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        if (session?.user) {
          load();
        } else {
          setApps([]);
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [current, impersonated]);

  const hasAccess = loading ? null : apps.some((a) => a.slug === current);

  return { apps, loading, hasAccess };
}
