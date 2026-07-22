import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration — BattlePlan HQ.
 *
 * This is the one native binary: it contains BattlePlan, BattleCards and
 * BattleBench, and the in-app switcher moves between them. The per-app Android
 * project that used to live under apps/battleplan is gone, replaced by this.
 *
 * appId stays `com.bamington.battleplan` even though the app is now called
 * BattlePlan HQ. It's an internal identifier users never see, it's already
 * registered in Supabase's redirect allow-list, and Play treats a changed
 * appId as an entirely different app — so changing it would cost a new listing
 * and buy nothing.
 *
 * It must stay in step with:
 *   - NATIVE_SCHEMES in packages/ui/src/lib/supabase.ts
 *   - the intent filter in android/app/src/main/AndroidManifest.xml
 */
const config: CapacitorConfig = {
  appId: 'com.bamington.battleplan',
  appName: 'BattlePlan HQ',
  webDir: 'dist',
  server: {
    // Serve over https:// rather than http:// inside the WebView. Supabase's
    // auth client treats the origin as secure, which localStorage persistence
    // and the crypto used by PKCE both depend on.
    androidScheme: 'https',
  },
};

export default config;
