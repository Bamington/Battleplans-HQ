import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration
 * Controls how the app is packaged for iOS and Android.
 *
 * - appId:   Unique bundle identifier for the app on app stores
 * - appName: Display name shown on the device
 * - webDir:  The folder Vite builds into — Capacitor wraps this for native deployment
 */
const config: CapacitorConfig = {
  appId: 'com.bamington.battlecards',
  appName: 'BattleCards',
  webDir: 'dist',
  server: {
    // During development, allow live-reload from the Vite dev server
    androidScheme: 'https'
  }
};

export default config;
