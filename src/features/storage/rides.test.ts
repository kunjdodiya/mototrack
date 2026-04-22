import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Ride, TrackPoint } from '../../types/ride'

const rideStore = new Map<string, Ride>()

vi.mock('./db', () => ({
  db: {
    rides: {
      get: (id: string) => Promise.resolve(rideStore.get(id)),
      put: (ride: Ride) => {
        rideStore.set(ride.id, ride)
        return Promise.resolve()
      },
    },
  },
}))

import { trimRide } from './rides'

function point(ts: number, lat: number, lng: number): TrackPoint {
  return { ts, lat, lng, speed: 10, alt: null, acc: 5 }
}

function seedRide(): Ride {
  const startedAt = 1_700_000_000_000
  const endedAt = startedAt + 7_200_000 // 2 hours
  const track: TrackPoint[] = [
    point(startedAt, 12.9716, 77.5946),
    point(startedAt + 60_000, 12.9726, 77.5946),
    point(startedAt + 120_000, 12.9736, 77.5946),
    point(startedAt + 3_600_000, 12.9746, 77.5946),
    point(endedAt, 12.9756, 77.5946),
  ]
  const ride: Ride = {
    id: 'ride-1',
    deviceId: 'device-1',
    startedAt,
    endedAt,
    track,
    stats: {
      distanceMeters: 500,
      durationMs: 7_200_000,
      movingDurationMs: 600_000,
      idleDurationMs: 6_600_000,
      avgSpeedMps: 0.07,
      maxSpeedMps: 10,
      maxLeanAngleDeg: null,
      elevationGainMeters: null,
    },
    syncedAt: 1_700_000_100_000,
  }
  rideStore.set(ride.id, ride)
  return ride
}

describe('trimRide', () => {
  beforeEach(() => {
    rideStore.clear()
  })

  it('returns null when the id is unknown', async () => {
    const result = await trimRide('missing', Date.now())
    expect(result).toBeNull()
  })

  it('truncates track, recomputes stats, clears syncedAt', async () => {
    const ride = seedRide()
    const cutoff = ride.startedAt + 150_000

    const updated = await trimRide(ride.id, cutoff)

    expect(updated).not.toBeNull()
    expect(updated!.endedAt).toBe(cutoff)
    expect(updated!.track).toHaveLength(3)
    expect(updated!.stats.durationMs).toBe(150_000)
    expect(updated!.stats.distanceMeters).toBeGreaterThan(0)
    expect(updated!.syncedAt).toBeNull()
    expect(rideStore.get(ride.id)!.endedAt).toBe(cutoff)
  })

  it('clamps a cutoff past the original end down to endedAt (no-op trim)', async () => {
    const ride = seedRide()
    const updated = await trimRide(ride.id, ride.endedAt + 10 * 3600_000)
    expect(updated!.endedAt).toBe(ride.endedAt)
    expect(updated!.track).toHaveLength(5)
  })

  it('clamps a cutoff before startedAt up to startedAt', async () => {
    const ride = seedRide()
    const updated = await trimRide(ride.id, ride.startedAt - 1_000_000)
    expect(updated!.endedAt).toBe(ride.startedAt)
    expect(updated!.track).toHaveLength(1)
  })
})
