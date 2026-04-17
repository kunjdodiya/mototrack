import type { TrackPoint } from '../../types/ride'

export type GeoError = { code: number; message: string }

export type ShareArgs = {
  blob: Blob
  filename: string
  title?: string
  text?: string
}

export type ShareResult = 'shared' | 'downloaded'

/**
 * The platform contract. Everything that differs between mobile web and the
 * future Capacitor native build goes through this interface. When v2 wraps
 * the app as a native iOS/Android shell, swap `./web` for `./capacitor` and
 * nothing else changes in the codebase.
 */
export interface Platform {
  watchPosition(
    onPoint: (p: TrackPoint) => void,
    onError: (e: GeoError) => void,
  ): () => void

  requestWakeLock(): Promise<() => void>

  sharePng(args: ShareArgs): Promise<ShareResult>
}
