import type { Ride } from '../../types/ride'

export type TripStats = {
  dayCount: number
  distanceMeters: number
  durationMs: number
  movingDurationMs: number
  idleDurationMs: number
  elevationGainMeters: number | null
  avgSpeedMps: number | null
  maxSpeedMps: number | null
  maxLeanAngleDeg: number | null
  startedAt: number | null
  endedAt: number | null
}

/**
 * Aggregate the rides in a trip into one combined stats block.
 *
 * Sums: distance, duration, moving/idle time, elevation gain.
 * Takes max: top speed, max lean angle.
 * Derives: trip-wide avg speed from total distance / total moving time.
 * Spans: startedAt = earliest ride start, endedAt = latest ride end.
 *
 * Rides are expected to share a tripId — this function does not filter.
 */
export function combineTripStats(rides: Ride[]): TripStats {
  if (rides.length === 0) {
    return {
      dayCount: 0,
      distanceMeters: 0,
      durationMs: 0,
      movingDurationMs: 0,
      idleDurationMs: 0,
      elevationGainMeters: null,
      avgSpeedMps: null,
      maxSpeedMps: null,
      maxLeanAngleDeg: null,
      startedAt: null,
      endedAt: null,
    }
  }

  let distance = 0
  let duration = 0
  let moving = 0
  let idle = 0
  let elev = 0
  let elevSeen = false
  let topSpeed: number | null = null
  let maxLean: number | null = null
  let startedAt = Number.POSITIVE_INFINITY
  let endedAt = Number.NEGATIVE_INFINITY

  for (const r of rides) {
    const s = r.stats
    distance += s.distanceMeters ?? 0
    duration += s.durationMs ?? 0
    moving += s.movingDurationMs ?? 0
    idle += s.idleDurationMs ?? 0
    if (s.elevationGainMeters != null) {
      elev += s.elevationGainMeters
      elevSeen = true
    }
    if (s.maxSpeedMps != null && (topSpeed == null || s.maxSpeedMps > topSpeed)) {
      topSpeed = s.maxSpeedMps
    }
    if (
      s.maxLeanAngleDeg != null &&
      (maxLean == null || s.maxLeanAngleDeg > maxLean)
    ) {
      maxLean = s.maxLeanAngleDeg
    }
    if (r.startedAt < startedAt) startedAt = r.startedAt
    if (r.endedAt > endedAt) endedAt = r.endedAt
  }

  const movingSec = moving / 1000
  const avgSpeed = movingSec > 0 ? distance / movingSec : null

  return {
    dayCount: rides.length,
    distanceMeters: distance,
    durationMs: duration,
    movingDurationMs: moving,
    idleDurationMs: idle,
    elevationGainMeters: elevSeen ? elev : null,
    avgSpeedMps: avgSpeed,
    maxSpeedMps: topSpeed,
    maxLeanAngleDeg: maxLean,
    startedAt: Number.isFinite(startedAt) ? startedAt : null,
    endedAt: Number.isFinite(endedAt) ? endedAt : null,
  }
}
