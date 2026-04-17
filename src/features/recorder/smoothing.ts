import type { TrackPoint } from '../../types/ride'
import { haversine } from '../stats/haversine'

/** Reject obviously bad fixes from watchPosition. */
export type Decision = { accept: true } | { accept: false; reason: string }

export function shouldAcceptPoint(
  next: TrackPoint,
  prev: TrackPoint | null,
): Decision {
  // Indoors / tunnels deliver accuracy ≫ 30 m — treat as garbage.
  if (next.acc > 30) {
    return { accept: false, reason: `acc ${next.acc.toFixed(0)}m > 30m` }
  }

  if (!prev) return { accept: true }

  const dist = haversine(prev.lat, prev.lng, next.lat, next.lng)

  // Parked at a red light jittering by 2-3m — collapse to a single point.
  if (dist < 5) {
    return { accept: false, reason: `<5m from prev` }
  }

  // Sudden accuracy collapse while barely moving = cell-tower triangulation,
  // not real GPS. Reject; next fix is usually clean.
  if (next.acc > 2 * prev.acc && dist < 20) {
    return { accept: false, reason: `accuracy collapse` }
  }

  return { accept: true }
}
