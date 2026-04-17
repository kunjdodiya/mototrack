import type { Platform } from './types'

/**
 * STUB — to be implemented when v2 adds Capacitor native wrappers.
 *
 * Migration steps (documented in the plan file):
 *   1. npm install @capacitor/core @capacitor/ios @capacitor/android \
 *        @capacitor/geolocation @capacitor/share @capacitor/filesystem
 *   2. npx cap init mototrack com.kunjdodiya.mototrack
 *   3. npx cap add ios && npx cap add android
 *   4. Implement the three methods below against @capacitor/geolocation,
 *      @capacitor/share, and @capacitor/filesystem.
 *   5. Flip ./index.ts to export capacitorPlatform instead of webPlatform.
 *
 * Critical: true background geolocation on iOS requires these Info.plist keys
 *   - NSLocationAlwaysAndWhenInUseUsageDescription
 *   - UIBackgroundModes: [location]
 */
export const capacitorPlatform: Platform = {
  watchPosition() {
    throw new Error('capacitorPlatform not implemented yet')
  },
  async requestWakeLock() {
    throw new Error('capacitorPlatform not implemented yet')
  },
  async sharePng() {
    throw new Error('capacitorPlatform not implemented yet')
  },
}
