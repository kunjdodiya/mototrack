import type { TrackPoint } from '../../types/ride'
import { haversine } from './haversine'

const G = 9.81
const MIN_SPEED_MPS = 3
const MAX_LEAN_DEG = 55

/** Initial bearing from a→b in radians, range (-π, π]. */
function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const φ1 = (a.lat * Math.PI) / 180
  const φ2 = (b.lat * Math.PI) / 180
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return Math.atan2(y, x)
}

/** Shortest signed angular difference (radians) in (-π, π]. */
function angleDelta(a: number, b: number): number {
  let d = b - a
  while (d > Math.PI) d -= 2 * Math.PI
  while (d <= -Math.PI) d += 2 * Math.PI
  return d
}

/**
 * Estimate peak lean angle (degrees) across a ride from GPS trajectory alone.
 *
 * Physics: a motorcycle cornering at speed v with turn rate ω has steady-state
 * lean θ = atan(v · ω / g). We derive ω as the bearing-change rate between
 * consecutive points and v as the segment speed (GPS speed if present, else
 * haversine/Δt).
 *
 * Caveats: GPS noise can fake big turn rates at low speed, so we ignore
 * segments under MIN_SPEED_MPS. The cap at MAX_LEAN_DEG discards obvious
 * garbage from a single spurious fix.
 */
export function maxLeanAngleDeg(points: TrackPoint[]): number | null {
  if (points.length < 3) return null

  let maxLean = 0
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]
    const b = points[i]
    const c = points[i + 1]
    const dt = (c.ts - a.ts) / 1000
    if (dt <= 0) continue

    const dist = haversine(a.lat, a.lng, c.lat, c.lng)
    const segSpeed = dist / dt
    const v = b.speed != null ? b.speed : segSpeed
    if (v < MIN_SPEED_MPS) continue

    const br1 = bearing(a, b)
    const br2 = bearing(b, c)
    const omega = Math.abs(angleDelta(br1, br2)) / dt
    if (!Number.isFinite(omega) || omega === 0) continue

    const leanRad = Math.atan((v * omega) / G)
    const leanDeg = (leanRad * 180) / Math.PI
    if (leanDeg > MAX_LEAN_DEG) continue
    if (leanDeg > maxLean) maxLean = leanDeg
  }

  return maxLean > 0 ? maxLean : null
}
