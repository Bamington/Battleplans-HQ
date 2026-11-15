/**
 * server/profileOg.ts — server-rendered link preview for a /@name profile page.
 *
 * Every app mounts the same ProfilePage at /@name, and every app is a
 * single-page app: no chat app or social crawler runs JavaScript, so a pasted
 * profile link previews as just "BattlePlan". Each app's vercel.json sends
 * /@name to its own api/profile-og.ts, a three-line wrapper around this, so the
 * logic lives once. Same approach as BattlePack's api/og.ts and BattleBench's
 * api/share-og.ts (read og.ts for the full reasoning): look the profile up,
 * inject Open Graph tags into the real index.html, return it. The app then
 * boots exactly as normal.
 *
 * Reads through the same two doors the page uses — get_public_profile and
 * get_location_profile — with the anon key, so a preview can never show more
 * than a signed-out visitor sees. A private or test club returns null there,
 * and gets the plain shell here.
 *
 *   store / club — name (title), tagline + About (description), cover banner
 *                  as a large image, else the logo as a small one
 *   player       — @handle and their avatar
 *
 * Never breaks the page: every failure returns the untouched shell.
 *
 * Runs on Vercel's edge runtime, so it must stay free of browser-only imports:
 * nothing from the app's supabase client, plain fetch only.
 */

// Provided by the edge runtime; declared here so this file needs no Node types.
declare const process: { env: Record<string, string | undefined> };

const CACHE_SECONDS = 300;
const STALE_SECONDS = 86_400;
const DESCRIPTION_LIMIT = 200;
const AVATAR_BUCKET = 'avatars';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Markdown to one line of plain text — the same rules as BattlePack's og.ts. */
function plain(md: string | null | undefined): string {
  return (md ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Card {
  title: string;
  description: string;
  image: string | null;
  /** A wide banner reads best as a large card; a square logo as a small one. */
  largeImage: boolean;
  canonicalHandle: string;
}

interface LocationPayload {
  location: { slug: string; name: string; kind: 'venue' | 'club'; icon: string | null; address: string | null };
  profile?: { tagline?: string | null; about?: string | null; cover_url?: string | null } | null;
}

function locationCard(p: LocationPayload, site: string): Card {
  const { location: loc, profile } = p;
  const isClub = loc.kind === 'club';
  const about = plain(profile?.about);
  const fallback = isClub
    ? `Gaming club on ${site}: events, club nights and where they play.`
    : `Gaming store${loc.address ? ` at ${loc.address}` : ''}. Opening hours, events and table bookings on ${site}.`;
  const description = [profile?.tagline?.trim(), about || fallback].filter(Boolean).join(' — ');
  const logo = loc.icon?.startsWith('http') ? loc.icon : null;
  return {
    title: loc.name,
    description,
    image: profile?.cover_url || logo,
    largeImage: !!profile?.cover_url,
    canonicalHandle: loc.slug,
  };
}

function playerCard(p: { handle: string; avatar_path: string | null }, site: string, supabaseUrl: string): Card {
  return {
    title: `@${p.handle}`,
    description: `@${p.handle} on ${site}.`,
    image: p.avatar_path
      ? `${supabaseUrl}/storage/v1/object/public/${AVATAR_BUCKET}/${encodeURI(p.avatar_path)}`
      : null,
    largeImage: false,
    canonicalHandle: p.handle,
  };
}

async function rpc(supabaseUrl: string, anonKey: string, fn: string, handle: string): Promise<unknown> {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify({ p_handle: handle }),
  });
  return res.ok ? res.json() : null;
}

/**
 * Handle a request for /@name (vercel.json passes it as ?handle=@name).
 * `site` is the app's own name, for og:site_name and the page title.
 */
export async function profileOgHandler(req: Request, site: string): Promise<Response> {
  const url    = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  const handle = (url.searchParams.get('handle') ?? '').replace(/^@/, '').trim();

  // The page itself, as the build wrote it. A real file, so this can't loop.
  const shell = await (await fetch(`${origin}/index.html`)).text();

  const passthrough = () => new Response(shell, {
    // Not cached: a club that goes public, or a handle that's claimed, should
    // get its card straight away.
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });

  try {
    if (!handle || handle.length > 64) return passthrough();

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey     = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      console.error('profile-og: Supabase configuration missing');
      return passthrough();
    }

    // Both at once, as the page does. A player would win, though the database
    // keeps the two namespaces from ever overlapping.
    const [player, place] = await Promise.all([
      rpc(supabaseUrl, anonKey, 'get_public_profile', handle),
      rpc(supabaseUrl, anonKey, 'get_location_profile', handle),
    ]) as [{ handle: string; avatar_path: string | null } | null, LocationPayload | null];

    const card = player?.handle ? playerCard(player, site, supabaseUrl)
      : place?.location ? locationCard(place, site)
      : null;
    if (!card) return passthrough();

    const description = truncate(card.description, DESCRIPTION_LIMIT);
    const canonical = `${origin}/@${encodeURIComponent(card.canonicalHandle)}`;
    const tags = [
      `<meta property="og:type" content="profile" />`,
      `<meta property="og:site_name" content="${esc(site)}" />`,
      `<meta property="og:title" content="${esc(card.title)}" />`,
      `<meta property="og:url" content="${esc(canonical)}" />`,
      description ? `<meta property="og:description" content="${esc(description)}" />` : '',
      card.image ? `<meta property="og:image" content="${esc(card.image)}" />` : '',
      `<meta name="twitter:card" content="${card.image && card.largeImage ? 'summary_large_image' : 'summary'}" />`,
      `<meta name="twitter:title" content="${esc(card.title)}" />`,
      description ? `<meta name="twitter:description" content="${esc(description)}" />` : '',
      card.image ? `<meta name="twitter:image" content="${esc(card.image)}" />` : '',
      description ? `<meta name="description" content="${esc(description)}" />` : '',
      `<link rel="canonical" href="${esc(canonical)}" />`,
    ].filter(Boolean).join('\n    ');

    const html = shell
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(`${card.title} — ${site}`)}</title>`)
      .replace('</head>', `    ${tags}\n  </head>`);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`,
      },
    });
  } catch (error) {
    console.error('profile-og: falling back to the plain shell:', error);
    return passthrough();
  }
}
