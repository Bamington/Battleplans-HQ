import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration — how BattlePlan is packaged for iOS and Android.
 *
 * appId is load-bearing beyond being an identifier: it doubles as the custom
 * URL scheme that brings a user back into the app after an auth redirect. It
 * must stay in step with two other places, or sign-in breaks with no error:
 *   - NATIVE_SCHEMES in packages/ui/src/lib/supabase.ts
 *   - the intent filter in android/app/src/main/AndroidManifest.xml
 * and it must be listed as a redirect URL in the Supabase dashboard.
 */
const config: CapacitorConfig = {
  appId: 'com.bamington.battleplan',
  appName: 'BattlePlan',
  webDir: 'dist',
  server: {
    // Serve over https:// rather than http:// inside the WebView. Supabase's
    // auth client treats the origin as secure, which localStorage persistence
    // and the crypto used by PKCE both depend on.
    androidScheme: 'https',
  },
};

export default config;
