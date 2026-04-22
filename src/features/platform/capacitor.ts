import { Geolocation } from '@capacitor/geolocation'
import { Share } from '@capacitor/share'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Browser } from '@capacitor/browser'
import { App, type URLOpenListenerEvent } from '@capacitor/app'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { registerPlugin } from '@capacitor/core'
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation'
import type {
  HapticStyle,
  Platform,
  GeoError,
  PermissionState,
  ShareArgs,
  ShareResult,
} from './types'
import type { TrackPoint } from '../../types/ride'

const IMPACT_STYLE: Record<HapticStyle, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  'BackgroundGeolocation',
)

/**
 * Native (Capacitor) implementation of the Platform contract. Selected at
 * runtime by ./index.ts when running inside a Capacitor shell — the same
 * React bundle that ships to mototrack.pages.dev also works wrapped as a
 * native iOS/Android app.
 *
 * Background GPS uses @capacitor-community/background-geolocation, which on
 * Android runs a foreground service (with a persistent notification — see
 * `backgroundMessage` below) and on iOS leans on the UIBackgroundModes entry.
 *
 * Required native config (already in repo):
 *
 *   iOS  → ios/App/App/Info.plist:
 *            <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
 *            <key>NSLocationWhenInUseUsageDescription</key>
 *            <key>UIBackgroundModes</key><array><string>location</string></array>
 *            <key>CFBundleURLTypes</key>... (for the OAuth deep link)
 *
 *   Android → android/app/src/main/AndroidManifest.xml:
 *            ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION,
 *            FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION,
 *            POST_NOTIFICATIONS, plus an intent-filter on the deep-link scheme.
 */
export const capacitorPlatform: Platform = {
  isNative: true,

  watchPosition(
    onPoint: (p: TrackPoint) => void,
    onError: (e: GeoError) => void,
  ): () => void {
    let watcherId: string | null = null
    let cancelled = false

    const start = async () => {
      try {
        watcherId = await BackgroundGeolocation.addWatcher(
          {
            // Defining `backgroundMessage` is what flips this watcher into
            // foreground-service mode on Android — without it, the OS kills
            // GPS updates within seconds of the screen locking. On iOS, the
            // UIBackgroundModes=[location] entitlement keeps it alive while
            // "Always" permission is granted.
            backgroundMessage:
              'Recording your ride. Tap to return to MotoTrack.',
            backgroundTitle: 'MotoTrack — recording ride',
            requestPermissions: true,
            stale: false,
            distanceFilter: 0,
          },
          (location, error) => {
            if (error) {
              onError({
                kind:
                  error.code === 'NOT_AUTHORIZED'
                    ? 'permission-denied'
                    : 'unknown',
                code: 0,
                message: error.message ?? String(error.code ?? 'geo error'),
              })
              return
            }
            if (!location) return
            onPoint({
              lat: location.latitude,
              lng: location.longitude,
              ts: location.time ?? Date.now(),
              speed: location.speed ?? null,
              alt: location.altitude ?? null,
              acc: location.accuracy ?? 0,
            })
          },
        )
        if (cancelled && watcherId) {
          // stop() was called before the watcher registration resolved.
          await BackgroundGeolocation.removeWatcher({ id: watcherId })
          watcherId = null
        }
      } catch (err) {
        onError({
          kind: 'unknown',
          code: -1,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    void start()

    return () => {
      cancelled = true
      if (watcherId) {
        void BackgroundGeolocation.removeWatcher({ id: watcherId })
        watcherId = null
      }
    }
  },

  async checkLocationPermission(): Promise<PermissionState> {
    try {
      const result = await Geolocation.checkPermissions()
      if (result.location === 'granted') return 'granted'
      if (result.location === 'denied') return 'denied'
      return 'prompt'
    } catch {
      return 'prompt'
    }
  },

  // Capacitor keeps the screen on by default while the app is foreground,
  // and background GPS (configured in native Info.plist / AndroidManifest)
  // continues recording even when the screen locks. No Wake Lock API dance
  // needed. Return a no-op releaser.
  async requestWakeLock() {
    return () => {}
  },

  async openAuthUrl(url: string) {
    // SFSafariViewController on iOS / Chrome Custom Tab on Android. Shares
    // cookies with the system browser, so a returning user is usually one
    // tap (already signed in to Google) instead of typing a password.
    await Browser.open({ url, presentationStyle: 'popover' })
  },

  async closeAuthBrowser() {
    try {
      await Browser.close()
    } catch {
      // The browser may already be closed (user dismissed it manually,
      // or the deep-link return auto-dismissed it). That's fine.
    }
  },

  onAppUrl(handler: (url: string) => void) {
    const sub = App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      handler(event.url)
    })
    return () => {
      void sub.then((s) => s.remove())
    }
  },

  hapticTap(style: HapticStyle = 'medium') {
    // Fire-and-forget Taptic Engine (iOS) / vibrator (Android) pulse.
    // Errors are swallowed because haptics are decorative, not functional.
    void Haptics.impact({ style: IMPACT_STYLE[style] }).catch(() => {})
  },

  onAppResume(handler: () => void) {
    // Fire only on background → foreground transitions. The plugin also
    // emits `isActive: false` when the app is backgrounded; we ignore that
    // half so the live-sync loop doesn't fire on pause.
    const sub = App.addListener('appStateChange', (state) => {
      if (state.isActive) handler()
    })
    return () => {
      void sub.then((s) => s.remove())
    }
  },

  async sharePng(args: ShareArgs): Promise<ShareResult> {
    // Capacitor's Share plugin wants a file:// URL, not a Blob. Write the
    // PNG to the cache directory first, then hand the URI to Share.
    const base64 = await blobToBase64(args.blob)

    const written = await Filesystem.writeFile({
      path: args.filename,
      data: base64,
      directory: Directory.Cache,
      encoding: Encoding.UTF8.valueOf() === 'utf8' ? undefined : undefined,
      // No encoding = base64 is decoded to binary automatically.
    })

    try {
      await Share.share({
        title: args.title,
        text: args.text,
        url: written.uri,
        dialogTitle: 'Share ride',
      })
      return 'shared'
    } catch (err) {
      // User cancelled the native share sheet — that's fine.
      if (err instanceof Error && /cancel/i.test(err.message)) {
        return 'shared'
      }
      // Fallback: file is saved to cache; at least it persists.
      return 'downloaded'
    }
  },
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}
