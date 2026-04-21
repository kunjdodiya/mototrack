import type { TrackPoint } from '../../types/ride'
import { haversine } from '../stats/haversine'

export type Decision = { accept: true } | { accept: false; reason: string }

/**
 * Decide whether to accept a raw GPS fix from watchPosition.
 *
 * Tuned for the realities of iOS Safari's web geolocation: cold-start
 * accuracies of 50–500 m are normal before the chip warms up, and on
 * devices with "Precise Location" disabled, Safari returns ~1-3 km
 * accuracy indefinitely. A 30 m hard cutoff rejects every fix in those
 * cases and looks to the user like "GPS is broken".
 *
 * Policy:
 *   - Always accept the first point so the user sees immediate feedback.
 *   - Accept fixes up to 100 m accuracy (good enough for route shape).
 *   - Also accept any fix that moved > 25 m from the previous point —
 *     real movement is real regardless of reported accuracy.
 *   - Drop jitter < 5 m from the previous point.
 *   - Drop sudden accuracy collapses (cell-tower triangulation).
 */
export function shouldAcceptPoint(
  next: TrackPoint,
  prev: TrackPoint | null,
): Decision {
  if (!prev) return { accept: true }

  const dist = haversine(prev.lat, prev.lng, next.lat, next.lng)

  if (dist < 5) {
    return { accept: false, reason: `<5m from prev` }
  }

  if (next.acc > 2 * prev.acc && dist < 20) {
    return { accept: false, reason: `accuracy collapse` }
  }

  if (next.acc > 100 && dist < 25) {
    return { accept: false, reason: `acc ${next.acc.toFixed(0)}m > 100m and <25m move` }
  }

  return { accept: true }
}
