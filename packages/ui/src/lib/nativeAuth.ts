/**
 * nativeAuth.ts — auth plumbing that only exists inside a Capacitor shell.
 *
 * On the web, an auth round-trip is just a redirect: the browser leaves for
 * Google, comes back to /auth/callback, and supabase-js reads the code out of
 * the URL because `detectSessionInUrl` is on. None of that holds on native.
 *
 * Two things break, and this module fixes both:
 *
 *   1. Google refuses to render its consent screen inside an embedded WebView
 *      (`disallowed_useragent`), so the sign-in has to be handed to the system
 *      browser and the result handed back.
 *   2. That handoff comes back as a deep link into the app rather than a page
 *      load, so nothing ever puts the code in a URL supabase-js can see. The
 *      app has to catch the link and do the exchange itself.
 *
 * Everything here is a no-op on web, so callers don't need their own platform
 * checks. The Capacitor plugins are imported lazily for the same reason — they
 * stay out of the web bundle entirely.
 */

import { Capacitor } from '@capacitor/core'
import type { Provider } from '@supabase/supabase-js'
import { supabase, authRedirectTo } from './supabase'

/**
 * Send the SPA to a route from outside React.
 *
 * The deep-link listener fires on the Capacitor bridge, well outside the router,
 * so there's no navigate() to call. Pushing the entry and re-emitting popstate
 * is what react-router already listens for, which keeps this working without
 * having to thread a router reference through app startup.
 */
function navigateApp(target: string): void {
  window.history.pushState({}, '', target)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/**
 * Split a deep link into the in-app route it stands for.
 *
 * `com.bamington.battleplan://auth/callback?code=xyz` → `/auth/callback?code=xyz`
 *
 * Done by hand rather than with `new URL()`: for a non-special scheme the host
 * ("auth") and pathname ("/callback") land in separate fields that have to be
 * recombined anyway, and the parser's behaviour there is easy to get subtly
 * wrong. A string split has no such ambiguity.
 */
function routeFromDeepLink(rawUrl: string): { path: string; query: string } {
  const schemeEnd = rawUrl.indexOf('://')
  const rest = schemeEnd === -1 ? rawUrl : rawUrl.slice(schemeEnd + 3)
  const queryStart = rest.indexOf('?')
  const pathPart = queryStart === -1 ? rest : rest.slice(0, queryStart)
  const query = queryStart === -1 ? '' : rest.slice(queryStart)
  return { path: '/' + pathPart.replace(/^\/+/, ''), query }
}

/**
 * Start listening for auth deep links. Call once at startup, before render.
 *
 * Resolves immediately on web. On native it registers a listener for the
 * lifetime of the app — there's no matching teardown because the only thing
 * that ends its usefulness is the process exiting.
 */
export async function initNativeAuth(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const { App } = await import('@capacitor/app')
  const { Browser } = await import('@capacitor/browser')

  await App.addListener('appUrlOpen', async ({ url }) => {
    const { path, query } = routeFromDeepLink(url)

    // Only auth redirects are ours to handle. Anything else is someone else's
    // deep link (or a future share/intent target) and should pass through.
    if (!path.startsWith('/auth/')) return

    // The custom tab sits on top of the app until it's dismissed. Android
    // usually tears it down on the redirect; iOS reliably does not.
    await Browser.close().catch(() => {
      // No browser open, or the platform closed it already. Not a failure.
    })

    // Navigate BEFORE exchanging, so the callback screen is mounted and
    // listening when the auth state changes. It also means a recovery link —
    // which redirects to /auth/reset-password, not /auth/callback — lands on
    // the right screen without this code having to know the difference.
    navigateApp(path + query)

    const code = new URLSearchParams(query).get('code')
    if (!code) return // An ?error= link: the callback screen reads and shows it.

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // Re-enter the callback screen with the failure spelled out, rather than
      // leaving it to sit on "Signing you in…" until its timeout fires.
      const params = new URLSearchParams({
        error: 'exchange_failed',
        error_description: error.message,
      })
      navigateApp(`${path}?${params}`)
    }
  })
}

/**
 * Begin an OAuth sign-in, by whichever route the current platform allows.
 *
 * On web this is the ordinary redirect. On native the URL is opened in the
 * system browser instead, because providers reject embedded WebViews; the user
 * returns through the deep link that `initNativeAuth` is waiting for.
 *
 * Returns a Supabase-shaped `{ error }` either way, so callers can treat both
 * paths identically. Note that on success the web path never returns — the page
 * is already navigating away.
 */
export async function signInWithProvider(
  provider: Provider,
): Promise<{ error: { message: string } | null }> {
  const redirectTo = authRedirectTo()

  if (!Capacitor.isNativePlatform()) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })
    return { error }
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error) return { error }
  if (!data?.url) {
    return { error: { message: 'Could not start sign-in. Please try again.' } }
  }

  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url: data.url })
  return { error: null }
}
