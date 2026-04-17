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

/**
 * The platform contract. Everything that differs between mobile web and the
 * Capacitor native shell goes through this interface. Feature code must never
 * touch navigator.geolocation or @capacitor/* directly.
 */
export interface Platform {
  watchPosition(
    onPoint: (p: TrackPoint) => void,
    onError: (e: GeoError) => void,
  ): () => void

  checkLocationPermission(): Promise<PermissionState>

  requestWakeLock(): Promise<() => void>

  sharePng(args: ShareArgs): Promise<ShareResult>
}
