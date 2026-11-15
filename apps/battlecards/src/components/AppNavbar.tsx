import { useEffect, useState } from 'react';
import { useLocation, useSearchParams, matchPath } from 'react-router-dom';
import { Navbar, supabase } from '@battleplans/ui';
import type { Breadcrumb } from '@battleplans/ui';

// The platform switcher's app list is no longer defined here — Navbar loads the
// apps this user may access from the database (see supabase/migrations/
// 20260719120000_platform_access.sql).

// ── Breadcrumbs ────────────────────────────────────────────────────────────
// One entry per screen. The trail's last crumb is the current page. Home is
// intentionally omitted from '/app' so the home screen shows no breadcrumb.

const HOME:  Breadcrumb = { label: 'Home',        href: '/app' };
const ADMIN: Breadcrumb = { label: 'Admin Tools', href: '/app/admin' };
const PACKS: Breadcrumb = { label: 'Packs',       href: '/app/packs' };
const RYG:   Breadcrumb = { label: 'Repent Ye Foolish Gods', href: '/app/builder/ryg' };

const CRUMBS: { pattern: string; trail: Breadcrumb[] }[] = [
  { pattern: '/app/admin',                trail: [HOME, { label: 'Admin Tools' }] },
  { pattern: '/app/admin/users',          trail: [HOME, ADMIN, { label: 'Manage Users' }] },
  { pattern: '/app/admin/games',          trail: [HOME, ADMIN, { label: 'Manage Games' }] },
  { pattern: '/app/admin/packs',          trail: [HOME, ADMIN, { label: 'Manage Packs' }] },
  { pattern: '/app/packs',                trail: [HOME, { label: 'Packs' }] },
  { pattern: '/app/packs/new',            trail: [HOME, PACKS, { label: 'New Pack' }] },
  { pattern: '/app/packs/:packId/edit',   trail: [HOME, PACKS, { label: 'Edit Pack' }] },
  { pattern: '/app/builder/blood-bowl',      trail: [HOME, { label: 'Blood Bowl' }] },
  { pattern: '/app/builder/halo-flashpoint', trail: [HOME, { label: 'Halo: Flashpoint' }] },
  { pattern: '/app/builder/kill-team',       trail: [HOME, { label: 'Kill Team' }] },
  { pattern: '/app/builder/starcraft',       trail: [HOME, { label: 'StarCraft' }] },
  { pattern: '/app/builder/ryg',          trail: [HOME, { label: 'Repent Ye Foolish Gods' }] },
  { pattern: '/app/builder/ryg-sept',     trail: [HOME, RYG, { label: 'Septs' }] },
  { pattern: '/app/builder/ryg-god',      trail: [HOME, RYG, { label: 'Gods' }] },
  { pattern: '/app/print',                trail: [HOME, { label: 'Print' }] },
];

/** Game names by slug, shared across navbars so each game is fetched once. */
const gameNames = new Map<string, string>();

/** Display name of a game from its slug (null until loaded). */
function useGameName(slug: string | null): string | null {
  const [name, setName] = useState<string | null>(slug ? gameNames.get(slug) ?? null : null);
  useEffect(() => {
    if (!slug) { setName(null); return; }
    const cached = gameNames.get(slug);
    if (cached) { setName(cached); return; }
    let live = true;
    supabase.from('games').select('name').eq('slug', slug).maybeSingle().then(({ data }) => {
      const n = (data as { name: string } | null)?.name;
      if (!n) return;
      gameNames.set(slug, n);
      if (live) setName(n);
    });
    return () => { live = false; };
  }, [slug]);
  return name;
}

/**
 * Trail for the current screen. Viewing a deck (/app/deck/:slug?deckId=…, or a
 * legacy /app/builder/<game>?deckId=…) shows Home › Game › Deck name.
 */
function useBreadcrumbs(deckName: string | null | undefined): Breadcrumb[] {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const deckId = params.get('deckId');
  const deckMatch = matchPath({ path: '/app/deck/:slug', end: true }, pathname);
  const gameName = useGameName(deckMatch?.params.slug ?? null);

  if (deckMatch) {
    return [HOME, { label: gameName ?? '…' }, { label: deckName || 'Deck' }];
  }
  for (const { pattern, trail } of CRUMBS) {
    if (!matchPath({ path: pattern, end: true }, pathname)) continue;
    // Legacy builder routes: add the deck as the current page.
    if (deckId && pattern.startsWith('/app/builder/') && !pattern.includes('ryg-')) {
      return [...trail, { label: deckName || 'Deck' }];
    }
    return trail;
  }
  return [];
}

type NavbarProps = Parameters<typeof Navbar>[0];

export interface AppNavbarProps extends Omit<NavbarProps, 'apps'> {
  /** Current deck's name, shown as the last breadcrumb on deck pages. */
  deckName?: string | null;
}

export default function AppNavbar({ deckName, ...props }: AppNavbarProps) {
  const crumbs = useBreadcrumbs(deckName);
  return <Navbar {...props} breadcrumbs={props.breadcrumbs ?? crumbs} />;
}
