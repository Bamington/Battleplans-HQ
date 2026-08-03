/**
 * link-preview — reads the Open Graph tags behind a URL, so a pack can show
 * what is on the other end of its Tickets and Registration links.
 *
 * A browser cannot do this itself: fetching another origin's HTML is exactly
 * what CORS exists to stop. So it happens here, and the result is cached in
 * public.link_previews.
 *
 * Contract — POST { url }:
 *   → 200 { url, title, description, image_url, site_name, ok }
 *   → 400 { error }   missing, malformed, or a URL we refuse to fetch
 *
 * A page that cannot be read is NOT an error. It answers 200 with ok:false, and
 * that answer is cached — a dead link costs one timeout to discover and the
 * caller should not pay it again on every render.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS FUNCTION FETCHES URLS SUPPLIED BY USERS. That makes it a server-side
 * request forgery hole unless it is careful, because it runs somewhere a
 * browser does not: with a different view of the network. `http://169.254.169.254/`
 * is a metadata endpoint from here and nothing from a laptop.
 *
 * So, in order:
 *   - only http and https — no file:, no data:, no gopher:
 *   - the host is resolved and every address checked against the private,
 *     loopback, link-local and unique-local ranges BEFORE the request
 *   - redirects are followed MANUALLY, one at a time, re-checking each hop.
 *     Automatic redirects are the classic bypass: the first URL is public and
 *     the 302 points at 127.0.0.1
 *   - a timeout, so a server that never answers does not hold a worker open
 *   - a byte cap, so the response cannot be a 10 GB file
 *   - only text/html is parsed; anything else is not a page with tags on it
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Env (provided automatically by the Supabase runtime):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ─────────────────────────────────────────────────────────────────────

const ALLOWED_HOSTS = [
  'battleplan.app',
  'battlecards.app',
  'battlebench.app',
  'battlepack.app',
];

function isAllowedOrigin(origin: string): boolean {
  let url: URL;
  try { url = new URL(origin); } catch { return false; }
  if (url.protocol === 'https:') {
    if (ALLOWED_HOSTS.includes(url.hostname.replace(/^www\./, ''))) return true;
    if (/^[a-z0-9-]+\.vercel\.app$/.test(url.hostname)) return true;
  }
  if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    return true;
  }
  return false;
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin) ? origin : 'null',
    // x-client-info and x-supabase-api-version are added by supabase-js on
    // every call, so omitting them fails the PREFLIGHT and the request never
    // leaves the browser — with a generic "failed to send" that says nothing
    // about headers. curl does not enforce CORS, so this only ever shows up
    // from a real page.
    'Access-Control-Allow-Headers':
      'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// ── Limits ───────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 6000;
/** Tags live in <head>; 512 KB reaches it on even a badly built page. */
const MAX_BYTES        = 512 * 1024;
const MAX_REDIRECTS    = 4;
/** How long a good answer stands before it is fetched again. */
const FRESH_HOURS      = 24 * 7;
/** Failures are retried sooner — a dead link may just have been a bad minute. */
const FRESH_HOURS_FAIL = 6;

// ── SSRF guard ───────────────────────────────────────────────────────────────

/** True for addresses that are not on the public internet. */
function isPrivateAddress(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');

  // Named hosts that never point outward.
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) {
    return true;
  }

  // IPv4
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 127) return true;                         // loopback
    if (a === 0) return true;                           // this network
    if (a === 169 && b === 254) return true;            // link-local, incl. metadata
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;  // carrier-grade NAT
    if (a >= 224) return true;                          // multicast and reserved
    return false;
  }

  // IPv6
  if (h.includes(':')) {
    if (h === '::1' || h === '::') return true;         // loopback / unspecified
    if (h.startsWith('fe80')) return true;              // link-local
    if (/^f[cd]/.test(h)) return true;                  // unique-local fc00::/7
    // ::ffff:127.0.0.1 and friends — an IPv4 address wearing a hat.
    const mapped = h.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }

  return false;
}

/**
 * Resolve the host and refuse if ANY address it answers with is private.
 *
 * Any, not the first: a name that resolves to both a public and a private
 * address is a DNS rebinding attempt, and picking the public one to justify the
 * request is exactly the mistake being avoided.
 */
async function resolvesPublicly(hostname: string): Promise<boolean> {
  if (isPrivateAddress(hostname)) return false;

  // A literal IP needs no lookup, and Deno.resolveDns would reject it.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) return true;

  try {
    const records = await Promise.allSettled([
      Deno.resolveDns(hostname, 'A'),
      Deno.resolveDns(hostname, 'AAAA'),
    ]);
    const addresses = records
      .filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // No addresses at all: let fetch fail on its own rather than guessing.
    if (addresses.length === 0) return true;
    return addresses.every(a => !isPrivateAddress(a));
  } catch {
    // Resolution failed — the fetch will fail too, and failing open here only
    // means a slightly worse error message.
    return true;
  }
}

/** Normalise so the cache does not split one page across several rows. */
function normaliseUrl(raw: string): URL | null {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  // Tracking parameters change nothing about the page being described.
  for (const p of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']) {
    url.searchParams.delete(p);
  }
  return url;
}

// ── Fetch ────────────────────────────────────────────────────────────────────

interface Preview {
  title: string | null;
  description: string | null;
  image_url: string | null;
  favicon_url: string | null;
  site_name: string | null;
  ok: boolean;
}

const EMPTY: Preview = {
  title: null, description: null, image_url: null, favicon_url: null, site_name: null, ok: false,
};

/** Read at most MAX_BYTES of the body as text, then stop. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  const joined = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { joined.set(c.subarray(0, Math.min(c.length, total - at)), at); at += c.length; }
  return new TextDecoder('utf-8', { fatal: false }).decode(joined);
}

/**
 * Follow redirects by hand, checking each hop.
 *
 * `redirect: 'manual'` is the entire point: letting fetch follow them would
 * check the first URL and then happily land wherever the 302 pointed.
 */
async function safeFetch(start: URL): Promise<Response | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await resolvesPublicly(url.hostname))) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          // Identifying honestly. Some sites serve different markup to bots,
          // and pretending to be Chrome to get better tags is the kind of thing
          // that gets an IP range blocked.
          'User-Agent': 'BattlepackLinkPreview/1.0 (+https://battlepack.app)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en',
        },
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel().catch(() => {});
      if (!location) return null;
      try { url = new URL(location, url); } catch { return null; }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      continue;
    }

    return res;
  }
  return null; // too many redirects
}

// ── Parse ────────────────────────────────────────────────────────────────────

/** The named entities that actually turn up in titles and descriptions. */
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', middot: '·',
  eacute: 'é', egrave: 'è', uuml: 'ü', ouml: 'ö', auml: 'ä',
  trade: '™', copy: '©', reg: '®', deg: '°', pound: '£', euro: '€',
};

/**
 * Turn HTML entities back into characters.
 *
 * NUMERIC ENTITIES ARE THE POINT. Real pages are full of `&#x27;` for an
 * apostrophe and `&#xA;` for a newline — Ko-fi's titles are — and a decoder
 * that only knows a handful of named ones leaves `Mini Myths&#x27;s Ko-fi Shop`
 * sitting in the card. Both bases are handled, and unknown entities are left
 * alone rather than mangled into something worse.
 *
 * Whitespace collapses to single spaces at the end. A description is rendered
 * as one flowing block clamped to two lines, so an embedded newline buys
 * nothing and costs a line.
 */
const decodeEntities = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
    })
    // Named last: decoding &amp; first would turn "&amp;#39;" into an apostrophe
    // when the page meant to show the literal text "&#39;".
    .replace(/&([a-z][a-z0-9]*);/gi, (whole, name) => NAMED[name.toLowerCase()] ?? whole)
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Pull one meta tag's content.
 *
 * Regex rather than a DOM parser because the input is at most 512 KB of
 * somebody else's HTML and the requirement is four strings. Attribute order
 * varies, so both orders are tried.
 */
function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, 'i'),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]?.trim()) return decodeEntities(m[1]);
    }
  }
  return null;
}

/**
 * The site's icon.
 *
 * Declared icons are preferred in rough order of how likely they are to be a
 * decent size — an apple-touch-icon is at least 120px, whereas a bare
 * `rel="icon"` is often a 16px .ico that looks like a smudge next to text.
 * `/favicon.ico` is the last resort because every site has that path whether or
 * not anything is served from it, so it is a guess rather than a statement.
 */
function parseFavicon(html: string, finalUrl: URL): string | null {
  const rels = [
    'apple-touch-icon',
    'icon',
    'shortcut icon',
    'apple-touch-icon-precomposed',
  ];
  for (const rel of rels) {
    const re = new RegExp(`<link[^>]+rel=["'][^"']*\\b${rel}\\b[^"']*["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const href = tag?.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) {
      try {
        const resolved = new URL(decodeEntities(href), finalUrl);
        if (resolved.protocol === 'http:' || resolved.protocol === 'https:') return resolved.toString();
      } catch { /* try the next rel */ }
    }
  }
  try { return new URL('/favicon.ico', finalUrl).toString(); } catch { return null; }
}

function parsePreview(html: string, finalUrl: URL): Preview {
  const title =
    metaContent(html, ['og:title', 'twitter:title']) ??
    (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]) : null);

  const description = metaContent(html, ['og:description', 'twitter:description', 'description']);
  const siteName    = metaContent(html, ['og:site_name']);
  const rawImage    = metaContent(html, ['og:image', 'og:image:url', 'twitter:image']);

  // Images are routinely relative. Resolved against the FINAL url, not the
  // requested one, or a redirect leaves every image pointing at the wrong host.
  let image: string | null = null;
  if (rawImage) {
    try {
      const resolved = new URL(rawImage, finalUrl);
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') image = resolved.toString();
    } catch { /* unusable image, keep the rest */ }
  }

  // A title is the minimum worth showing. Without one there is nothing to put
  // on the card that the URL does not already say.
  return {
    title,
    description,
    image_url: image,
    favicon_url: parseFavicon(html, finalUrl),
    site_name: siteName,
    ok: !!title,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  let raw: string;
  try {
    raw = (await req.json())?.url ?? '';
  } catch {
    return json(400, { error: 'Expected a JSON body with a url.' });
  }

  const url = normaliseUrl(String(raw));
  if (!url) return json(400, { error: 'That is not an http or https URL.' });
  if (isPrivateAddress(url.hostname)) return json(400, { error: 'That address is not reachable.' });

  const key = url.toString();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Cached and still fresh? Answer from the row and touch nothing.
  const { data: cached } = await supabase
    .from('link_previews')
    .select('*')
    .eq('url', key)
    .maybeSingle();

  if (cached) {
    const ageHours = (Date.now() - new Date(cached.fetched_at).getTime()) / 3_600_000;
    const limit = cached.ok ? FRESH_HOURS : FRESH_HOURS_FAIL;
    if (ageHours < limit) return json(200, { ...cached, url: key });
  }

  // Fetch, parse, and store whatever we learned — including that we learned
  // nothing, which is worth remembering.
  let preview: Preview = EMPTY;
  const res = await safeFetch(url);
  if (res) {
    const type = res.headers.get('content-type') ?? '';
    if (res.ok && type.includes('text/html')) {
      const html = await readCapped(res);
      preview = parsePreview(html, new URL(res.url || key));
    } else {
      await res.body?.cancel().catch(() => {});
    }
  }

  const row = { url: key, ...preview, fetched_at: new Date().toISOString() };
  await supabase.from('link_previews').upsert(row, { onConflict: 'url' });

  return json(200, row);
});
