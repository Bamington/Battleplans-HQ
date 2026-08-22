/**
 * api/og.ts — server-rendered social preview for a published event page.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * BattlePack is a single-page app: index.html is an empty <div id="root"> and
 * every word on a pack page is written by JavaScript. No social crawler runs
 * JavaScript. Facebook, Discord, Slack, WhatsApp and iMessage all fetch the URL
 * once, read the <head>, and render whatever is there — which, until this
 * existed, was the title "BattlePack" and nothing else, for every event.
 *
 * So the HTML has to arrive with the tags already in it. This function is the
 * only thing on the public path that runs before the browser does: it looks the
 * pack up, injects the tags into the real index.html, and returns it. The app
 * then boots exactly as it always did — nothing about the client changes, and
 * the page a human sees is the page they always saw.
 *
 * ── What it must never do ────────────────────────────────────────────────
 *
 * BREAK THE PAGE. Every failure path returns the untouched index.html rather
 * than an error: an event page that loads without a rich preview is a
 * disappointment, and one that 500s because a lookup timed out is an outage. So
 * every fetch is guarded and the whole body is wrapped.
 *
 * Reads through `battlepack_by_slug` with the anon key — the same door the
 * browser uses, and the only one that exists. There is no service role here and
 * there should not be: this runs on an unauthenticated public path.
 *
 * Cached at the edge, because the alternative is a Supabase round trip for
 * every scroll past a link in a Discord channel.
 */

export const config = { runtime: 'edge' };

/** How long the CDN may serve a preview before revalidating, in seconds. */
const CACHE_SECONDS = 300;
/** How long it may keep serving a stale one while it refreshes, in seconds. */
const STALE_SECONDS = 86_400;

/** The most description a preview card will show before it truncates anyway. */
const DESCRIPTION_LIMIT = 200;

/** Object key prefix for a pack banner. Mirrors BANNER_BUCKET in lib/packs.ts. */
const BANNER_BUCKET = 'pack-banners';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Escape a value for interpolation into an HTML attribute. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Markdown to something worth putting in a preview card.
 *
 * The About section is rich text — headings, bold, links, bullet lists. A card
 * shows one or two lines of plain text, so the markup is stripped rather than
 * shown as asterisks. Deliberately crude: this is a summary, and the cost of a
 * mangled edge case is one slightly odd sentence in a preview.
 */
function plainText(markdown: string | null | undefined): string {
  if (!markdown) return '';
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')            // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')          // links → their text
    .replace(/`{1,3}[^`]*`{1,3}/g, '')                // code
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')               // headings
    .replace(/^\s{0,3}>\s?/gm, '')                    // quotes
    .replace(/^\s*[-*+]\s+/gm, '')                    // bullets
    .replace(/[*_~]/g, '')                            // emphasis
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cut on a word boundary, so a card never ends mid-word. */
function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

interface GameArtManifest {
  banners: Record<string, string>;
  icons: Record<string, string>;
}

/**
 * The game's own artwork, for a pack with no banner of its own.
 *
 * Comes from `game-art.json`, written by the build — the artwork is bundled
 * under content hashes that only the build knows, and all 116 rows in `games`
 * have a null icon and a null image. See tools/vite/game-art-manifest.
 *
 * Prefers the wide logo over the square icon: this fills a 1200×630 card, which
 * is the shape the logos were drawn for and the shape an icon is stretched into.
 */
async function gameArtUrl(origin: string, gameSlug: string | undefined): Promise<string | null> {
  if (!gameSlug) return null;
  try {
    const res = await fetch(`${origin}/game-art.json`);
    if (!res.ok) return null;
    const manifest = (await res.json()) as GameArtManifest;
    const path = manifest.banners?.[gameSlug] ?? manifest.icons?.[gameSlug];
    // The filenames have spaces in them ("Star Wars Shatterpoint Logo-x.png"),
    // and a crawler will not guess what to do with a raw one.
    return path ? `${origin}${encodeURI(path)}` : null;
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  const url    = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  const slug   = url.searchParams.get('slug') ?? '';

  // The page itself, exactly as the build wrote it. A real file, so the rewrite
  // that sent us here does not apply and this cannot loop back into itself.
  const shellRes = await fetch(`${origin}/index.html`);
  const shell    = await shellRes.text();

  const passthrough = () =>
    new Response(shell, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Not cached: an unresolved slug today may be a published pack
        // tomorrow, and a shared link is exactly the thing people click early.
        'Cache-Control': 'no-store',
      },
    });

  try {
    if (!slug.trim()) return passthrough();

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey     = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      console.error('og: Supabase configuration missing');
      return passthrough();
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/battlepack_by_slug`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ lookup: slug.trim() }),
    });
    if (!res.ok) return passthrough();

    const data = await res.json();
    // withdrawn / gone / unknown all render their own explanation in the app.
    // None of them wants a rich card: a preview for an event that is not
    // happening is worse than a plain link.
    if (data?.state !== 'published' || !data?.pack) return passthrough();

    const pack = data.pack;
    const by   = data.host?.name ?? data.creator?.name ?? null;

    const title = by
      ? `BattlePack: ${pack.name} by ${by}`
      : `BattlePack: ${pack.name}`;

    const description = truncate(plainText(pack.description), DESCRIPTION_LIMIT);

    const image = pack.banner_path
      ? `${supabaseUrl}/storage/v1/object/public/${BANNER_BUCKET}/${encodeURI(pack.banner_path)}`
      : await gameArtUrl(origin, data.game?.slug);

    const canonical = `${origin}/${data.display_slug ?? pack.slug ?? slug}`;

    const tags = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="BattlePack" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:url" content="${esc(canonical)}" />`,
      description ? `<meta property="og:description" content="${esc(description)}" />` : '',
      image ? `<meta property="og:image" content="${esc(image)}" />` : '',
      // summary_large_image needs an image to be large about; without one the
      // small card is the honest choice and looks deliberate rather than broken.
      `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
      `<meta name="twitter:title" content="${esc(title)}" />`,
      description ? `<meta name="twitter:description" content="${esc(description)}" />` : '',
      image ? `<meta name="twitter:image" content="${esc(image)}" />` : '',
      description ? `<meta name="description" content="${esc(description)}" />` : '',
      `<link rel="canonical" href="${esc(canonical)}" />`,
    ].filter(Boolean).join('\n    ');

    const html = shell
      // The shell's own <title> is the app's name, which is right for the app
      // and wrong for one event. Replaced rather than appended: two titles is
      // undefined behaviour and crawlers disagree about which wins.
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
      .replace('</head>', `    ${tags}\n  </head>`);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`,
      },
    });
  } catch (error) {
    // A preview is decoration. Losing it must never cost the page.
    console.error('og: falling back to the plain shell:', error);
    return passthrough();
  }
}
