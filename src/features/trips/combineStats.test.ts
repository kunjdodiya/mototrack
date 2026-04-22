import { describe, it, expect } from 'vitest'
import { combineTripStats } from './combineStats'
import type { Ride, RideStats } from '../../types/ride'

function ride(
  stats: Partial<RideStats>,
  overrides: Partial<Ride> = {},
): Ride {
  return {
    id: overrides.id ?? Math.random().toString(),
    deviceId: 'd',
    startedAt: overrides.startedAt ?? 0,
    endedAt: overrides.endedAt ?? 0,
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

describe('combineTripStats', () => {
  it('returns nulls and zeros for an empty trip', () => {
    const t = combineTripStats([])
    expect(t.sessionCount).toBe(0)
    expect(t.distanceMeters).toBe(0)
    expect(t.startedAt).toBeNull()
    expect(t.endedAt).toBeNull()
    expect(t.avgSpeedMps).toBeNull()
    expect(t.elevationGainMeters).toBeNull()
  })

  it('sums distance, duration, moving, idle, elevation across sessions', () => {
    const rides = [
      ride(
        {
          distanceMeters: 10_000,
          durationMs: 3_600_000,
          movingDurationMs: 3_000_000,
          idleDurationMs: 600_000,
          elevationGainMeters: 120,
        },
        { startedAt: 1_000, endedAt: 3_600_000 + 1_000 },
      ),
      ride(
        {
          distanceMeters: 25_000,
          durationMs: 7_200_000,
          movingDurationMs: 6_300_000,
          idleDurationMs: 900_000,
          elevationGainMeters: 800,
        },
        { startedAt: 86_400_000, endedAt: 86_400_000 + 7_200_000 },
      ),
    ]
    const t = combineTripStats(rides)
    expect(t.sessionCount).toBe(2)
    expect(t.distanceMeters).toBe(35_000)
    expect(t.durationMs).toBe(10_800_000)
    expect(t.movingDurationMs).toBe(9_300_000)
    expect(t.idleDurationMs).toBe(1_500_000)
    expect(t.elevationGainMeters).toBe(920)
  })

  it('takes max of top speed + max lean across sessions', () => {
    const rides = [
      ride({
        distanceMeters: 1_000,
        movingDurationMs: 60_000,
        maxSpeedMps: 20,
        maxLeanAngleDeg: 25,
      }),
      ride({
        distanceMeters: 1_000,
        movingDurationMs: 60_000,
        maxSpeedMps: 42,
        maxLeanAngleDeg: null,
      }),
      ride({
        distanceMeters: 1_000,
        movingDurationMs: 60_000,
        maxSpeedMps: null,
        maxLeanAngleDeg: 38,
      }),
    ]
    const t = combineTripStats(rides)
    expect(t.maxSpeedMps).toBe(42)
    expect(t.maxLeanAngleDeg).toBe(38)
  })

  it('derives avg speed from total distance over total moving time', () => {
    const rides = [
      ride({ distanceMeters: 1_000, movingDurationMs: 50_000 }),
      ride({ distanceMeters: 4_000, movingDurationMs: 150_000 }),
    ]
    const t = combineTripStats(rides)
    expect(t.movingDurationMs).toBe(200_000)
    // 5000 m / 200 s = 25 m/s
    expect(t.avgSpeedMps).toBe(25)
  })

  it('spans startedAt/endedAt across the full range', () => {
    const rides = [
      ride({}, { startedAt: 500, endedAt: 900 }),
      ride({}, { startedAt: 200, endedAt: 1200 }),
      ride({}, { startedAt: 700, endedAt: 1000 }),
    ]
    const t = combineTripStats(rides)
    expect(t.startedAt).toBe(200)
    expect(t.endedAt).toBe(1200)
  })

  it('returns null elevation when every session is missing it', () => {
    const rides = [
      ride({ distanceMeters: 1, movingDurationMs: 1, elevationGainMeters: null }),
      ride({ distanceMeters: 1, movingDurationMs: 1, elevationGainMeters: null }),
    ]
    const t = combineTripStats(rides)
    expect(t.elevationGainMeters).toBeNull()
  })
})
