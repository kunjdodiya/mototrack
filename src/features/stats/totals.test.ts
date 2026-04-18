import { describe, it, expect } from 'vitest'
import { sumTotals } from './totals'
import type { Ride, RideStats } from '../../types/ride'

function ride(stats: Partial<RideStats>, overrides: Partial<Ride> = {}): Ride {
  return {
    id: overrides.id ?? Math.random().toString(),
    deviceId: 'd',
    startedAt: 0,
    endedAt: 0,
    track: [],
    syncedAt: null,
    stats: {
      distanceMeters: 0,
      durationMs: 0,
      movingDurationMs: 0,
      idleDurationMs: 0,
      avgSpeedMps: null,
      maxSpeedMps: null,
      maxLeanAngleDeg: null,
      elevationGainMeters: null,
      ...stats,
    },
    ...overrides,
  }
}

describe('sumTotals', () => {
  it('returns zeroes for an empty list', () => {
    const t = sumTotals([])
    expect(t.rideCount).toBe(0)
    expect(t.totalDistanceMeters).toBe(0)
    expect(t.topSpeedMps).toBeNull()
    expect(t.maxLeanAngleDeg).toBeNull()
  })

  it('sums distance/duration and takes max of speed + lean', () => {
    const rides = [
      ride({ distanceMeters: 1000, durationMs: 60_000, movingDurationMs: 50_000, maxSpeedMps: 20, maxLeanAngleDeg: 25 }),
      ride({ distanceMeters: 2500, durationMs: 120_000, movingDurationMs: 100_000, maxSpeedMps: 35, maxLeanAngleDeg: 40 }),
      ride({ distanceMeters: 500, durationMs: 30_000, movingDurationMs: 20_000, maxSpeedMps: null, maxLeanAngleDeg: null }),
    ]
    const t = sumTotals(rides)
    expect(t.rideCount).toBe(3)
    expect(t.totalDistanceMeters).toBe(4000)
    expect(t.totalDurationMs).toBe(210_000)
    expect(t.totalMovingDurationMs).toBe(170_000)
    expect(t.topSpeedMps).toBe(35)
    expect(t.maxLeanAngleDeg).toBe(40)
  })
})
