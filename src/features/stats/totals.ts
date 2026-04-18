import type { Ride } from '../../types/ride'

export type RiderTotals = {
  rideCount: number
  totalDistanceMeters: number
  totalDurationMs: number
  totalMovingDurationMs: number
  topSpeedMps: number | null
  maxLeanAngleDeg: number | null
}

/** Aggregate rider stats across every ride in the local DB. */
export function sumTotals(rides: Ride[]): RiderTotals {
  let distance = 0
  let duration = 0
  let moving = 0
  let topSpeed: number | null = null
  let maxLean: number | null = null

  for (const r of rides) {
    distance += r.stats.distanceMeters ?? 0
    duration += r.stats.durationMs ?? 0
    moving += r.stats.movingDurationMs ?? 0
    const ts = r.stats.maxSpeedMps
    if (ts != null && (topSpeed == null || ts > topSpeed)) topSpeed = ts
    const ml = r.stats.maxLeanAngleDeg
    if (ml != null && (maxLean == null || ml > maxLean)) maxLean = ml
  }

  return {
    rideCount: rides.length,
    totalDistanceMeters: distance,
    totalDurationMs: duration,
    totalMovingDurationMs: moving,
    topSpeedMps: topSpeed,
    maxLeanAngleDeg: maxLean,
  }
}
