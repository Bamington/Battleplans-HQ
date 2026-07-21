/**
 * auth-handoff — mints a single-use token that logs a signed-in user into a
 * sibling Battleplans app.
 *
 * The apps live on separate apex domains (battleplan.app, battlecards.app,
 * battlebench.app), so they can't share localStorage or cookies. The platform
 * switcher used to bridge that gap by copying the user's *actual* refresh token
 * into the destination URL. That has a nasty failure mode: Supabase rotates
 * refresh tokens (`enable_refresh_token_rotation`, 10s reuse window), so once
 * two origins hold the same token, whichever refreshes first revokes the
 * other's copy and that app silently signs the user out — exactly the
 * "why am I logging in again?" symptom this replaces.
 *
 * Instead, the *source* app asks this function for a fresh one-time token. The
 * destination redeems it with `verifyOtp` and gets its own independent session,
 * with its own refresh token, that rotates on its own schedule. Neither app can
 * knock the other out, and the URL carries a short-lived single-use credential
 * rather than a long-lived one.
 *
 * Contract — POST, `Authorization: Bearer <caller's access token>`:
 *   → 200 { token_hash, email }   redeem with
 *                                 supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
 *   → 401 { error }               missing / invalid / expired caller token
 *
 * No email is sent: admin.generateLink() only *generates* the link, which is
 * why the hashed token can be handed straight to the destination app.
 *
 * Env (provided automatically by the Supabase runtime):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ──────────────────────────────────────────────────────────────────────
//
// Called from the browser, cross-origin, so the allowed origin has to be echoed
// back per request. Only the Battleplans apps may mint hand-off tokens — a
// stolen access token shouldn't also be exchangeable for a fresh session from
// some other site's page. Local dev ports are allowed so the switcher works
// against `pnpm dev`.

// Bare hosts. Each apex 308-redirects to its www subdomain, so `www` is the
// origin real users actually call from — both spellings are accepted rather
// than betting on which one a given entry point lands on.
const ALLOWED_HOSTS = [
  'battleplan.app',
  'battlecards.app',
  'battlebench.app',
];

/** True for our own apps, any of their Vercel deployments, and localhost dev. */
function isAllowedOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
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
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (origin && !isAllowedOrigin(origin)) {
    return json(403, { error: 'Origin not allowed' });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return json(401, { error: 'Missing bearer token' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('auth-handoff: missing Supabase environment variables');
    return json(500, { error: 'Server misconfigured' });
  }

  // Identify the caller from their own access token. Using the anon key here
  // (not the service role) means an expired or forged token simply fails.
  const asCaller = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await asCaller.auth.getUser();
  if (userError || !user?.email) {
    return json(401, { error: 'Not signed in' });
  }

  // generateLink() does not send an email — it returns the token we hand over.
  const asAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await asAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });

  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.error('auth-handoff: generateLink failed', error);
    return json(500, { error: 'Could not create hand-off token' });
  }

  return json(200, { token_hash: tokenHash, email: user.email });
});
