import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { getImpersonatedRole, setImpersonatedRole } from './impersonation'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

/**
 * The redirect URL used by Supabase after auth flows (password reset, OAuth, etc.).
 *
 * - On native (Android / iOS): uses the app's custom URL scheme so Capacitor
 *   can intercept the redirect and return the user to the app.
 * - On web: uses the current origin so the callback lands on the live site.
 */
export const redirectTo = Capacitor.isNativePlatform()
  ? 'com.bamington.battlecards://auth/callback'
  : `${window.location.origin}/auth/callback`

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // PKCE is required for mobile OAuth and magic-link flows inside a
    // Capacitor WebView, where the implicit flow cannot safely receive tokens.
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// ── Cross-app session hand-off ──────────────────────────────────────────────
//
// The Battleplans apps live on different origins (battlecards.app vs
// battleplan.app, and distinct *.vercel.app subdomains while testing), so they
// can't share localStorage or cookies. To keep the user logged in when they
// switch apps, the source app appends its session to the destination URL's hash
// fragment and the destination restores it on load. The hash is never sent to a
// server, and we scrub it from the URL immediately after consuming it.

const SESSION_HASH_KEY = 'bp_session'
// An admin's "view as" role travels with the session so the lens survives a
// switch between apps — the gate being per-app is the point of testing it.
const ROLE_HASH_KEY = 'bp_role'

/**
 * Append the current session to a cross-app URL so the destination can restore
 * it. Returns the href unchanged if there is no session (or on native, where
 * each platform is a single app and storage isn't split across origins).
 */
export async function appendSessionToUrl(href: string): Promise<string> {
  if (Capacitor.isNativePlatform()) return href
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return href
  const payload = encodeURIComponent(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  }))
  const sep = href.includes('#') ? '&' : '#'
  const role = getImpersonatedRole()
  return `${href}${sep}${SESSION_HASH_KEY}=${payload}` +
    (role ? `&${ROLE_HASH_KEY}=${role}` : '')
}

/**
 * Restore a session handed off via the URL hash, then scrub the token from the
 * URL and browser history. Call once, before the app reads the session. No-op
 * when there's no hand-off token present.
 */
export async function consumeSessionFromUrl(): Promise<void> {
  if (typeof window === 'undefined' || !window.location.hash) return
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const raw = params.get(SESSION_HASH_KEY)
  const role = params.get(ROLE_HASH_KEY)
  if (!raw && !role) return

  // Carry over an admin's "view as" lens. Safe to apply before knowing whether
  // the arriving user is an admin: my_platform_apps() ignores the pretend role
  // for anyone who isn't, and it can only ever narrow what they see.
  if (role === 'user' || role === 'beta_tester') setImpersonatedRole(role)

  if (raw) {
    try {
      const { access_token, refresh_token } = JSON.parse(decodeURIComponent(raw))
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token })
      }
    } catch {
      // Malformed hand-off — ignore and fall through to scrubbing the URL.
    }
  }

  // Remove the token from the URL + history so it can't leak or be re-used.
  params.delete(SESSION_HASH_KEY)
  params.delete(ROLE_HASH_KEY)
  const rest = params.toString()
  const clean = window.location.pathname + window.location.search + (rest ? `#${rest}` : '')
  window.history.replaceState(null, '', clean)
}

