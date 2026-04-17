import type { TrackPoint } from '../../types/ride'
import type { GeoError, GeoErrorKind, PermissionState } from '../platform/types'

export type { GeoError }

function kindFromCode(code: number): GeoErrorKind {
  if (code === 1) return 'permission-denied'
  if (code === 2) return 'position-unavailable'
  if (code === 3) return 'timeout'
  return 'unknown'
}

/**
 * Thin wrapper over navigator.geolocation.watchPosition that yields typed
 * TrackPoints. Returns a stop function. This module is the ONLY place in the
 * codebase that touches navigator.geolocation.
 */
export function watchPosition(
  onPoint: (p: TrackPoint) => void,
  onError: (e: GeoError) => void,
): () => void {
  if (!('geolocation' in navigator)) {
    onError({ kind: 'unsupported', code: -1, message: 'Geolocation API not available' })
    return () => {}
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      onPoint({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        ts: pos.timestamp,
        speed: pos.coords.speed,
        alt: pos.coords.altitude,
        acc: pos.coords.accuracy,
      })
    },
    (err) =>
      onError({
        kind: kindFromCode(err.code),
        code: err.code,
        message: err.message,
      }),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    },
  )

  return () => navigator.geolocation.clearWatch(id)
}

export async function checkLocationPermission(): Promise<PermissionState> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return 'unsupported'
  }
  if (!('permissions' in navigator) || !navigator.permissions?.query) {
    return 'prompt'
  }
  try {
    const status = await navigator.permissions.query({
      name: 'geolocation' as PermissionName,
    })
    if (status.state === 'granted') return 'granted'
    if (status.state === 'denied') return 'denied'
    return 'prompt'
  } catch {
    return 'prompt'
  }
}
