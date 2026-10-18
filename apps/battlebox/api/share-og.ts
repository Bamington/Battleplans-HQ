/**
 * api/share-og.ts — server-rendered link preview for a BattleBench share link.
 *
 * Mirrors BattlePack's api/og.ts (read that for the full reasoning). BattleBench
 * is a single-page app and no chat app or social crawler runs JavaScript, so a
 * pasted share link would preview as just "BattleBench". vercel.json sends
 * /s/<username>/<code> (and the original /s/<code>) here — only the code is
 * read: we look the shared item up, inject Open Graph tags into the
 * real index.html, and return it. The app then boots exactly as normal.
 *
 * Never breaks the page: every failure returns the untouched shell. Reads
 * through get_shared_item with the anon key — the same single door the page
 * uses; no service role on a public path. Purchase dates are never in what
 * that function returns, so they can't leak into a preview either.
 */

export const config = { runtime: 'edge' };

const CACHE_SECONDS = 300;
const STALE_SECONDS = 86_400;
const DESCRIPTION_LIMIT = 200;
const PHOTO_BUCKET = 'model-images';

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

interface Img {
  image_path: string | null; image_url?: string | null;
  is_primary: boolean; display_order: number; is_progress?: boolean; created_at?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  'None': 'Unpainted', 'Assembled': 'Assembled', 'Primed': 'Primed',
  'Partially Painted': 'Partially painted', 'Painted': 'Painted',
};

/** The same choice the app makes for a cover: finished photo (primary first),
 *  else the legacy image_path, else the newest progress photo. */
function modelCover(images: Img[], legacyPath: string | null): string | null {
  const finished = images.filter(i => !i.is_progress && i.image_path)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.display_order - b.display_order);
  if (finished[0]) return finished[0].image_path;
  if (legacyPath) return legacyPath;
  const progress = images.filter(i => i.is_progress && i.image_path)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return progress[0]?.image_path ?? null;
}

export default async function handler(req: Request): Promise<Response> {
  const url    = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  const token  = url.searchParams.get('token') ?? '';

  // The page itself, as the build wrote it. A real file, so this can't loop.
  const shellRes = await fetch(`${origin}/index.html`);
  const shell    = await shellRes.text();

  const passthrough = () => new Response(shell, {
    // Not cached: a link turned off and on again gets a new code, but an
    // unknown code today should never be served a stale preview tomorrow.
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });

  try {
    if (!token.trim()) return passthrough();

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey     = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      console.error('share-og: Supabase configuration missing');
      return passthrough();
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_shared_item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ p_token: token.trim() }),
    });
    if (!res.ok) return passthrough();

    const data = await res.json();
    // Unknown or switched-off link: the page explains itself; no rich card.
    if (!data?.item) return passthrough();

    const item  = data.item;
    const kind  = data.kind as 'model' | 'box' | 'recipe';
    const owner = data.owner?.handle ? `@${data.owner.handle}` : null;
    const photo = (path: string | null | undefined) =>
      path ? `${supabaseUrl}/storage/v1/object/public/${PHOTO_BUCKET}/${encodeURI(path)}` : null;

    let kindLabel = 'Model';
    let image: string | null = null;
    let description = '';

    if (kind === 'model') {
      image = photo(modelCover(item.images ?? [], item.image_path ?? null));
      const count = `${item.count} ${item.count === 1 ? 'model' : 'models'}`;
      description = [item.game?.name, STATUS_LABEL[item.status] ?? item.status, count].filter(Boolean).join(' · ');
    } else if (kind === 'box') {
      kindLabel = item.type === 'Box' ? 'Box' : 'Collection';
      const own = (item.images ?? [] as Img[]).slice().sort((a: Img, b: Img) => a.display_order - b.display_order)[0];
      image = own ? (own.image_path ? photo(own.image_path) : own.image_url ?? null)
        : photo((item.models ?? []).map((m: { images: Img[]; image_path: string | null }) => modelCover(m.images ?? [], m.image_path)).find(Boolean));
      const n = (item.models ?? []).length;
      description = [item.game?.name, `${n} ${n === 1 ? 'model' : 'models'}`].filter(Boolean).join(' · ');
    } else {
      kindLabel = 'Paint recipe';
      const imgs: Img[] = (item.images ?? []).slice()
        .sort((a: Img, b: Img) => Number(b.is_primary) - Number(a.is_primary) || a.display_order - b.display_order);
      image = photo(imgs[0]?.image_path);
      const paints: string[] = (item.paints ?? []).map((p: { name: string }) => p.name);
      description = paints.length
        ? `${paints.length} ${paints.length === 1 ? 'paint' : 'paints'}: ${paints.join(', ')}`
        : (item.description ?? '');
    }

    const title = owner ? `${item.name} — ${kindLabel} by ${owner}` : `${item.name} — ${kindLabel}`;
    description = truncate(description.replace(/\s+/g, ' ').trim(), DESCRIPTION_LIMIT);
    // /s/<username>/<code> with the owner's CURRENT username, whatever the
    // address that was pasted said (only the code is ever looked up).
    const canonical = data.owner?.handle
      ? `${origin}/s/${encodeURIComponent(data.owner.handle)}/${encodeURIComponent(token.trim())}`
      : `${origin}/s/${encodeURIComponent(token.trim())}`;

    const tags = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="BattleBench" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:url" content="${esc(canonical)}" />`,
      description ? `<meta property="og:description" content="${esc(description)}" />` : '',
      image ? `<meta property="og:image" content="${esc(image)}" />` : '',
      `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
      `<meta name="twitter:title" content="${esc(title)}" />`,
      description ? `<meta name="twitter:description" content="${esc(description)}" />` : '',
      image ? `<meta name="twitter:image" content="${esc(image)}" />` : '',
      description ? `<meta name="description" content="${esc(description)}" />` : '',
      // Share links are for whoever has them, not for search engines.
      data.public ? '' : `<meta name="robots" content="noindex" />`,
      `<link rel="canonical" href="${esc(canonical)}" />`,
    ].filter(Boolean).join('\n    ');

    const html = shell
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
      .replace('</head>', `    ${tags}\n  </head>`);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`,
      },
    });
  } catch (error) {
    console.error('share-og: falling back to the plain shell:', error);
    return passthrough();
  }
}
