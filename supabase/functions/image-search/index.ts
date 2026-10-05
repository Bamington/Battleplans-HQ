/**
 * image-search — helps BattleBench users find a photo for a new model or
 * collection, without leaving the Add form.
 *
 * Two actions, both POST, both for signed-in users only — checked in the
 * handler, since verify_jwt also lets the anon key through:
 *
 *   { action: 'search', query }
 *     → 200 { results: [{ thumbnail, image, title, source, width, height }] }
 *     Asks Brave's Image Search API. `thumbnail` is Brave's own proxied copy,
 *     safe to put straight in an <img>; `image` is the original on its site.
 *     Answers from image_search_cache when it can; otherwise takes one of the
 *     user's DAILY_LIMIT searches first (429 when they're out).
 *
 *   { action: 'fetch', url }
 *     → 200 the image bytes, Content-Type: application/octet-stream,
 *           X-Image-Type: the real image/* type
 *     A browser cannot read another origin's image as bytes (CORS), so the
 *     picked photo is fetched here and handed back for the client to upload
 *     into model-images like any other photo. Copying it in, rather than
 *     storing a link, is deliberate: hotlinked shop images vanish, and a
 *     collection's cover should not depend on an eBay listing staying up.
 *
 *     octet-stream, not the image type, because supabase-js only hands a Blob
 *     back for octet-stream — anything else it reads as text and mangles.
 *
 * Env:
 *   BRAVE_SEARCH_API_KEY   — set with `supabase secrets set`; without it,
 *                            search answers 503 and the UI says so.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `fetch` TAKES A URL FROM THE CLIENT, so it carries the same SSRF guard as
 * link-preview (copied, not shared — see that file for the reasoning behind
 * each rule): http/https only, every resolved address checked against private
 * ranges, redirects followed by hand and re-checked, a timeout, a byte cap,
 * and only image/* bodies returned.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ─────────────────────────────────────────────────────────────────────

const ALLOWED_HOSTS = ['battleplan.app', 'battlecards.app', 'battlebench.app', 'battlepack.app'];

function isAllowedOrigin(origin: string): boolean {
  let url: URL;
  try { url = new URL(origin); } catch { return false; }
  if (url.protocol === 'https:') {
    if (ALLOWED_HOSTS.includes(url.hostname.replace(/^www\./, ''))) return true;
    if (/^[a-z0-9-]+\.vercel\.app$/.test(url.hostname)) return true;
  }
  if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return true;
  return false;
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // The client reads the real type of a fetched image from this header.
    'Access-Control-Expose-Headers': 'X-Image-Type',
    'Vary': 'Origin',
  };
}

// ── Limits ───────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 8000;
/** Matches what the Add forms would accept from a camera roll, comfortably. */
const MAX_IMAGE_BYTES  = 15 * 1024 * 1024;
const MAX_REDIRECTS    = 4;
const MAX_QUERY_LEN    = 200;
const RESULT_COUNT     = 24;

// ── Spend control ────────────────────────────────────────────────────────────
// Brave charges per search beyond a $5 monthly credit (~1,000 searches). These
// keep BattleBench inside it; see migration 20261005130000.

/** Searches per user per day (UTC) that may reach Brave. Cache hits are free. */
const DAILY_LIMIT = 30;
/** How long a cached result set is reused. Box art doesn't change much. */
const CACHE_DAYS  = 30;

/** "  Leviathan   BOX set " and "leviathan box set" are one search. */
const normaliseQuery = (q: string) => q.toLowerCase().replace(/\s+/g, ' ').trim();

// ── SSRF guard (copied from link-preview) ────────────────────────────────────

function isPrivateAddress(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;

  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }

  if (h.includes(':')) {
    if (h === '::1' || h === '::') return true;
    if (h.startsWith('fe80')) return true;
    if (/^f[cd]/.test(h)) return true;
    const mapped = h.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return false;
}

async function resolvesPublicly(hostname: string): Promise<boolean> {
  if (isPrivateAddress(hostname)) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) return true;
  try {
    const records = await Promise.allSettled([
      Deno.resolveDns(hostname, 'A'),
      Deno.resolveDns(hostname, 'AAAA'),
    ]);
    const addresses = records
      .filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);
    if (addresses.length === 0) return true;
    return addresses.every(a => !isPrivateAddress(a));
  } catch {
    return true;
  }
}

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
          'User-Agent': 'BattleBenchImageFetch/1.0 (+https://battlebench.app)',
          'Accept': 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
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
  return null;
}

/** Read the whole body, or give up (null) once it passes the cap. */
async function readCappedBytes(res: Response): Promise<Uint8Array | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_IMAGE_BYTES) { await reader.cancel().catch(() => {}); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

// ── Search ───────────────────────────────────────────────────────────────────

interface BraveImage {
  title?: string;
  url?: string;
  source?: string;
  thumbnail?: { src?: string };
  properties?: { url?: string; width?: number; height?: number };
}

interface Result {
  thumbnail: string;
  image: string;
  title: string;
  source: string;
  width: number | null;
  height: number | null;
}

async function braveSearch(query: string, key: string): Promise<Result[] | null> {
  const url = new URL('https://api.search.brave.com/res/v1/images/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(RESULT_COUNT));
  url.searchParams.set('safesearch', 'strict');
  url.searchParams.set('search_lang', 'en');

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json', 'X-Subscription-Token': key },
  });
  if (!res.ok) {
    console.error('[image-search] brave', res.status, await res.text().catch(() => ''));
    return null;
  }
  const body = await res.json() as { results?: BraveImage[] };
  return (body.results ?? [])
    .map(r => ({
      thumbnail: r.thumbnail?.src ?? '',
      image: r.properties?.url ?? '',
      title: r.title ?? '',
      source: r.source ?? '',
      width: r.properties?.width ?? null,
      height: r.properties?.height ?? null,
    }))
    .filter(r => r.thumbnail && r.image);
}

// ── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  // verify_jwt alone is not enough: the public anon key is itself a valid JWT,
  // so anyone could spend the search quota. Require a real user's token.
  // (getUser must be given the token — see auth-handoff for why.)
  const token = (req.headers.get('Authorization') ?? '').replace(/^bearer\s+/i, '').trim();
  const caller = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = token ? await caller.auth.getUser(token) : { data: { user: null } };
  if (!user) return json(401, { error: 'Sign in to search for photos.' });

  let body: { action?: string; query?: string; url?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'Expected a JSON body.' }); }

  if (body.action === 'search') {
    const query = String(body.query ?? '').trim().slice(0, MAX_QUERY_LEN);
    if (!query) return json(400, { error: 'Nothing to search for.' });
    const key = Deno.env.get('BRAVE_SEARCH_API_KEY');
    if (!key) return json(503, { error: 'Image search is not set up yet.' });

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const cacheKey = normaliseQuery(query);

    // 1. Cache — free, and doesn't count towards the cap.
    const { data: cached } = await admin.from('image_search_cache')
      .select('results, fetched_at').eq('query_key', cacheKey).maybeSingle();
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_DAYS * 86_400_000) {
      return json(200, { results: cached.results, cached: true });
    }

    // 2. Cap — only searches that reach Brave cost anything, so only they count.
    const { data: allowed, error: capErr } = await admin.rpc('image_search_take', { p_user: user.id, p_limit: DAILY_LIMIT });
    if (capErr) {
      console.error('[image-search] cap', capErr);
      return json(500, { error: 'Image search is unavailable right now.' });
    }
    if (!allowed) {
      return json(429, { error: `You’ve used today’s ${DAILY_LIMIT} photo searches. Try again tomorrow, or upload a photo instead.` });
    }

    // 3. Brave, then remember the answer for everyone.
    const results = await braveSearch(query, key);
    if (!results) return json(502, { error: 'Image search is unavailable right now.' });
    await admin.from('image_search_cache')
      .upsert({ query_key: cacheKey, results, fetched_at: new Date().toISOString() }, { onConflict: 'query_key' });
    return json(200, { results });
  }

  if (body.action === 'fetch') {
    let url: URL;
    try { url = new URL(String(body.url ?? '')); } catch { return json(400, { error: 'That is not a URL.' }); }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return json(400, { error: 'That is not an http or https URL.' });
    if (isPrivateAddress(url.hostname)) return json(400, { error: 'That address is not reachable.' });

    const res = await safeFetch(url);
    if (!res || !res.ok) {
      await res?.body?.cancel().catch(() => {});
      return json(502, { error: 'Could not download that image.' });
    }
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    // SVG is excluded on purpose: it is a document that can carry script, and
    // it would be served back out of a public bucket.
    if (!type.startsWith('image/') || type === 'image/svg+xml') {
      await res.body?.cancel().catch(() => {});
      return json(415, { error: 'That link is not a photo.' });
    }
    const bytes = await readCappedBytes(res);
    if (!bytes) return json(413, { error: 'That image is too large.' });

    return new Response(bytes, {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/octet-stream', 'X-Image-Type': type },
    });
  }

  return json(400, { error: 'Unknown action.' });
});
