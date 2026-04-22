import type { HapticStyle, Platform } from './types'
import { watchPosition, checkLocationPermission } from '../recorder/geolocation'
import { requestWakeLock } from '../recorder/wakeLock'
import { sharePng } from '../share/share'

const VIBRATE_MS: Record<HapticStyle, number | number[]> = {
  light: 12,
  medium: 22,
  heavy: [30, 40, 60],
}

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

  hapticTap(style: HapticStyle = 'medium') {
    // Vibration API: supported on Android Chrome, no-op on iOS Safari.
    // navigator.vibrate throws only if the argument is invalid; our static
    // pattern map keeps it safe.
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
    try {
      navigator.vibrate(VIBRATE_MS[style])
    } catch {
      // Ignore — haptics are a nice-to-have.
    }
  },

  onAppResume() {
    // Web foregrounding is surfaced by `document.visibilitychange` +
    // `window.focus`, which liveSync hooks directly. No extra channel here.
    return () => {}
  },
}
