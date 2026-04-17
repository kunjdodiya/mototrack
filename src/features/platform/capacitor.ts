import { Geolocation } from '@capacitor/geolocation'
import { Share } from '@capacitor/share'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import type { Platform, GeoError, ShareArgs, ShareResult } from './types'
import type { TrackPoint } from '../../types/ride'

/**
 * Native (Capacitor) implementation of the Platform contract. Selected at
 * runtime by ./index.ts when running inside a Capacitor shell — the same
 * React bundle that ships to mototrack.pages.dev also works wrapped as a
 * native iOS/Android app.
 *
 * Enabling true background GPS requires ONE-TIME native config (not code):
 *
 *   iOS  → ios/App/App/Info.plist:
 *            <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
 *            <string>MotoTrack records your ride route while you're riding.</string>
 *            <key>NSLocationWhenInUseUsageDescription</key>
 *            <string>MotoTrack records your ride route while you're riding.</string>
 *            <key>UIBackgroundModes</key><array><string>location</string></array>
 *
 *   Android → android/app/src/main/AndroidManifest.xml:
 *            <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
 *            <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
 *            <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
 */
export const capacitorPlatform: Platform = {
  watchPosition(
    onPoint: (p: TrackPoint) => void,
    onError: (e: GeoError) => void,
  ): () => void {
    let watchId: string | null = null
    let cancelled = false

    const start = async () => {
      try {
        // Request permission up-front — Capacitor's plugin prompts the user
        // if we don't already have it.
        const perm = await Geolocation.requestPermissions({
          permissions: ['location'],
        })
        if (perm.location === 'denied') {
          onError({ code: 1, message: 'Location permission denied' })
          return
        }

        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15_000 },
          (pos, err) => {
            if (err) {
              onError({ code: 0, message: err.message ?? 'geolocation error' })
              return
            }
            if (!pos) return
            onPoint({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              ts: pos.timestamp,
              speed: pos.coords.speed ?? null,
              alt: pos.coords.altitude ?? null,
              acc: pos.coords.accuracy,
            })
          },
        )
        if (cancelled) {
          // stop() was called before watch registration resolved.
          await Geolocation.clearWatch({ id })
          return
        }
        watchId = id
      } catch (err) {
        onError({
          code: -1,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    void start()

    return () => {
      cancelled = true
      if (watchId) {
        void Geolocation.clearWatch({ id: watchId })
        watchId = null
      }
    }
  },

  // Capacitor keeps the screen on by default while the app is foreground,
  // and background GPS (configured in native Info.plist / AndroidManifest)
  // continues recording even when the screen locks. No Wake Lock API dance
  // needed. Return a no-op releaser.
  async requestWakeLock() {
    return () => {}
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
