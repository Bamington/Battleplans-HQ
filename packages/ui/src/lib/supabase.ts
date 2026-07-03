import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

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

