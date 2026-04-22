import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Ride, TrackPoint } from '../../types/ride'

const savedRides: Ride[] = []

vi.mock('../storage/rides', () => ({
  saveRide: (ride: Ride) => {
    savedRides.push(ride)
    return Promise.resolve()
  },
}))

vi.mock('../storage/sync', () => ({
  pushRide: vi.fn(() => Promise.resolve()),
}))

vi.mock('../storage/deviceId', () => ({
  getDeviceId: () => 'device-1',
}))

vi.mock('../platform', () => ({
  platform: {
    isNative: false,
    requestWakeLock: () => Promise.resolve(() => {}),
    watchPosition: () => () => {},
    hapticTap: vi.fn(),
  },
}))

import { useRecorder } from './useRecorder'

function makePoint(tsOffset: number, lat: number, lng: number): TrackPoint {
  return { ts: tsOffset, lat, lng, speed: 10, alt: null, acc: 5 }
}

describe('useRecorder.stopAt', () => {
  beforeEach(() => {
    savedRides.length = 0
    useRecorder.setState({
      status: 'idle',
      points: [],
      startedAt: null,
      name: null,
      bikeId: null,
      liveDistanceMeters: 0,
      liveDurationMs: 0,
      liveSpeedMps: null,
      error: null,
    })
  })

  it('returns null when idle', async () => {
    const ride = await useRecorder.getState().stopAt(Date.now())
    expect(ride).toBeNull()
  })

  it('trims points after the cutoff and recomputes stats', async () => {
    const startedAt = 1_700_000_000_000
    const points: TrackPoint[] = [
      makePoint(startedAt, 12.9716, 77.5946),
      makePoint(startedAt + 60_000, 12.9726, 77.5946), // +1 min, ~111m north
      makePoint(startedAt + 120_000, 12.9736, 77.5946), // +2 min
      makePoint(startedAt + 3_600_000, 12.9746, 77.5946), // +60 min (drifting)
      makePoint(startedAt + 7_200_000, 12.9756, 77.5946), // +120 min
    ]
    useRecorder.setState({
      status: 'recording',
      startedAt,
      points,
      liveDistanceMeters: 444,
      liveDurationMs: 7_200_000,
    })

    const cutoff = startedAt + 150_000 // 2.5 min in — keep first 3 points
    const ride = await useRecorder.getState().stopAt(cutoff)

    expect(ride).not.toBeNull()
    expect(ride!.startedAt).toBe(startedAt)
    expect(ride!.endedAt).toBe(cutoff)
    expect(ride!.track).toHaveLength(3)
    expect(ride!.stats.durationMs).toBe(150_000)
    expect(ride!.stats.distanceMeters).toBeGreaterThan(0)
    expect(ride!.stats.distanceMeters).toBeLessThan(300) // ~222 m for two hops
    expect(savedRides).toHaveLength(1)
    expect(savedRides[0].id).toBe(ride!.id)
    expect(useRecorder.getState().status).toBe('idle')
  })

  it('clamps a cutoff before startedAt up to startedAt', async () => {
    const startedAt = 1_700_000_000_000
    useRecorder.setState({
      status: 'recording',
      startedAt,
      points: [makePoint(startedAt, 0, 0), makePoint(startedAt + 10_000, 0, 0)],
    })

    const ride = await useRecorder.getState().stopAt(startedAt - 1_000_000)

    expect(ride).not.toBeNull()
    expect(ride!.endedAt).toBe(startedAt)
    expect(ride!.track).toHaveLength(1) // only the point with ts <= startedAt
  })
})
