import type { TrackPoint } from '../../types/ride'

export type GeoErrorKind =
  | 'permission-denied'
  | 'position-unavailable'
  | 'timeout'
  | 'unsupported'
  | 'unknown'

export type GeoError = {
  kind: GeoErrorKind
  code: number
  message: string
}

export type PermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported'

export type ShareArgs = {
  blob: Blob
  filename: string
  title?: string
  text?: string
}

export type ShareResult = 'shared' | 'downloaded'

export type HapticStyle = 'light' | 'medium' | 'heavy'

/**
 * The platform contract. Everything that differs between mobile web and the
 * Capacitor native shell goes through this interface. Feature code must never
 * touch navigator.geolocation or @capacitor/* directly.
 */
export interface Platform {
  /**
   * True when running inside the Capacitor native shell (iOS/Android app).
   * Auth and other flows that need a different shape on native vs web read
   * this instead of importing `@capacitor/core` themselves.
   */
  readonly isNative: boolean

  watchPosition(
    onPoint: (p: TrackPoint) => void,
    onError: (e: GeoError) => void,
  ): () => void

  checkLocationPermission(): Promise<PermissionState>

  requestWakeLock(): Promise<() => void>

  sharePng(args: ShareArgs): Promise<ShareResult>

  /**
   * Open the OAuth authorization URL.
   *  - Web: navigates the current tab.
   *  - Native: opens an in-app system browser (SFSafariViewController on iOS,
   *    Chrome Custom Tab on Android) so cookies/Google session are shared.
   */
  openAuthUrl(url: string): Promise<void>

  /**
   * Close the in-app auth browser (no-op on web). Called after we've
   * successfully exchanged the auth code for a session.
   */
  closeAuthBrowser(): Promise<void>

  /**
   * Subscribe to deep-link / app-launch URLs. Returns an unsubscribe fn.
   *  - Web: no-op (the page URL is already where it needs to be).
   *  - Native: forwards Capacitor's `appUrlOpen` events.
   */
  onAppUrl(handler: (url: string) => void): () => void

  /**
   * Fire a short haptic buzz. iOS native uses the Taptic Engine via the
   * Capacitor Haptics plugin; Android native + Chrome Android use the
   * Vibration API. Silent on platforms without either (iOS Safari, desktop).
   */
  hapticTap(style?: HapticStyle): void

  /**
   * Subscribe to "the app just came back to the foreground" events. Returns
   * an unsubscribe fn.
   *  - Web: no-op. Web foregrounding is covered by `document.visibilitychange`
   *    + `window.focus`, which the live-sync loop hooks directly.
   *  - Native: forwards Capacitor's `appStateChange` event, firing only when
   *    `isActive` flips from false to true (user returned from background).
   */
  onAppResume(handler: () => void): () => void
}
