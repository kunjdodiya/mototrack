import type { RideStats, TrackPoint } from '../../types/ride'
import { haversine } from './haversine'

/** Centered 5-point moving average on altitude. Undefined for <5 points. */
function smoothAlt(points: TrackPoint[]): (number | null)[] {
  return points.map((p, i) => {
    const window = points.slice(Math.max(0, i - 2), Math.min(points.length, i + 3))
    const vals = window.map((q) => q.alt).filter((a): a is number => a != null)
    if (vals.length === 0) return p.alt
    return vals.reduce((s, v) => s + v, 0) / vals.length
  })
}

export function computeStats(
  points: TrackPoint[],
  startedAt: number,
  endedAt: number,
): RideStats {
  if (points.length < 2) {
    return {
      distanceMeters: 0,
      durationMs: Math.max(0, endedAt - startedAt),
      movingDurationMs: 0,
      avgSpeedMps: null,
      maxSpeedMps: null,
      elevationGainMeters: null,
    }
  }

  let distance = 0
  let movingMs = 0
  let maxSpeed: number | null = null

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const d = haversine(a.lat, a.lng, b.lat, b.lng)
    distance += d
    const dt = b.ts - a.ts
    // Derived speed for this segment (m/s); covers the case where the device
    // never populated `speed` on the GeolocationPosition.
    const segSpeed = dt > 0 ? d / (dt / 1000) : 0
    if (segSpeed > 0.5) movingMs += dt

    const candidate = b.speed != null ? b.speed : segSpeed
    if (candidate != null && (maxSpeed == null || candidate > maxSpeed)) {
      maxSpeed = candidate
    }
  }

  // Elevation gain: only compute if every point has altitude. Browser GPS
  // altitudes are notoriously jittery, so we smooth before summing positive
  // deltas. Single missing reading invalidates the whole metric.
  let elevationGain: number | null = null
  const anyMissingAlt = points.some((p) => p.alt == null)
  if (!anyMissingAlt) {
    const smoothed = smoothAlt(points)
    let gain = 0
    for (let i = 1; i < smoothed.length; i++) {
      const prev = smoothed[i - 1]
      const curr = smoothed[i]
      if (prev != null && curr != null) {
        const delta = curr - prev
        if (delta > 0) gain += delta
      }
    }
    elevationGain = gain
  }

  const durationMs = endedAt - startedAt
  const movingSeconds = movingMs / 1000
  const avgSpeed = movingSeconds > 0 ? distance / movingSeconds : null

  return {
    distanceMeters: distance,
    durationMs,
    movingDurationMs: movingMs,
    avgSpeedMps: avgSpeed,
    maxSpeedMps: maxSpeed,
    elevationGainMeters: elevationGain,
  }
}
