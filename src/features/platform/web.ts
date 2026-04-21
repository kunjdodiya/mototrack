import type { Platform } from './types'
import { watchPosition, checkLocationPermission } from '../recorder/geolocation'
import { requestWakeLock } from '../recorder/wakeLock'
import { sharePng } from '../share/share'

export const webPlatform: Platform = {
  isNative: false,
  watchPosition,
  checkLocationPermission,
  requestWakeLock,
  sharePng,

  async openAuthUrl(url: string) {
    // Full navigation — Supabase will return us to /auth/callback with the
    // auth code, which AuthCallback.tsx + the Supabase client (PKCE) handle.
    window.location.assign(url)
  },

  async closeAuthBrowser() {
    // No browser to close on web; the OAuth provider already redirected back.
  },

  onAppUrl() {
    // The web flow lands the user back on /auth/callback as a full
    // navigation; there is no separate deep-link channel to listen to.
    return () => {}
  },
}
