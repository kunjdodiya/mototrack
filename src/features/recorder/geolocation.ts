import type { TrackPoint } from '../../types/ride'

export type GeoError = { code: number; message: string }

/**
 * Thin wrapper over navigator.geolocation.watchPosition that yields typed
 * TrackPoints. Returns a stop function. This module is the ONLY place in the
 * codebase that touches navigator.geolocation — swap for Capacitor later
 * without touching the recorder hook.
 */
export function watchPosition(
  onPoint: (p: TrackPoint) => void,
  onError: (e: GeoError) => void,
): () => void {
  if (!('geolocation' in navigator)) {
    onError({ code: -1, message: 'Geolocation API not available' })
    return () => {}
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      onPoint({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        ts: pos.timestamp,
        speed: pos.coords.speed, // may be null on desktop/iOS
        alt: pos.coords.altitude, // often null on iOS
        acc: pos.coords.accuracy,
      })
    },
    (err) => onError({ code: err.code, message: err.message }),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    },
  )

  return () => navigator.geolocation.clearWatch(id)
}
