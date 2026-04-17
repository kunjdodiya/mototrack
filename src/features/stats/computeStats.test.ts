import { describe, it, expect } from 'vitest'
import { computeStats } from './computeStats'
import type { TrackPoint } from '../../types/ride'

function pt(overrides: Partial<TrackPoint> = {}): TrackPoint {
  return {
    lat: 0,
    lng: 0,
    ts: 0,
    speed: null,
    alt: null,
    acc: 5,
    ...overrides,
  }
}

describe('computeStats', () => {
  it('returns zero distance and null speeds for an empty track', () => {
    const s = computeStats([], 1_000, 2_000)
    expect(s.distanceMeters).toBe(0)
    expect(s.durationMs).toBe(1_000)
    expect(s.avgSpeedMps).toBeNull()
    expect(s.maxSpeedMps).toBeNull()
    expect(s.elevationGainMeters).toBeNull()
  })

  it('returns zero distance for a single point', () => {
    const s = computeStats([pt({ lat: 1, lng: 1, ts: 1_000 })], 0, 2_000)
    expect(s.distanceMeters).toBe(0)
    expect(s.movingDurationMs).toBe(0)
  })

  it('accumulates distance along a two-point track', () => {
    const track: TrackPoint[] = [
      pt({ lat: 0, lng: 0, ts: 0 }),
      pt({ lat: 0, lng: 0.001, ts: 10_000 }),
    ]
    const s = computeStats(track, 0, 10_000)
    expect(s.distanceMeters).toBeGreaterThan(100)
    expect(s.distanceMeters).toBeLessThan(115)
    expect(s.durationMs).toBe(10_000)
  })

  it('computes moving time only for segments above the idle threshold', () => {
    const track: TrackPoint[] = [
      pt({ lat: 0, lng: 0, ts: 0 }),
      pt({ lat: 0, lng: 0.0001, ts: 1_000 }),
      pt({ lat: 0, lng: 0.01, ts: 30_000 }),
    ]
    const s = computeStats(track, 0, 30_000)
    expect(s.movingDurationMs).toBeGreaterThan(0)
    expect(s.movingDurationMs).toBeLessThanOrEqual(s.durationMs)
  })

  it('returns null elevationGain if any point is missing altitude', () => {
    const track: TrackPoint[] = [
      pt({ lat: 0, lng: 0, ts: 0, alt: 100 }),
      pt({ lat: 0, lng: 0.001, ts: 10_000, alt: null }),
    ]
    expect(computeStats(track, 0, 10_000).elevationGainMeters).toBeNull()
  })

  it('accumulates only positive elevation deltas', () => {
    const track: TrackPoint[] = [
      pt({ lat: 0, lng: 0, ts: 0, alt: 100 }),
      pt({ lat: 0, lng: 0.001, ts: 5_000, alt: 110 }),
      pt({ lat: 0, lng: 0.002, ts: 10_000, alt: 105 }),
      pt({ lat: 0, lng: 0.003, ts: 15_000, alt: 120 }),
    ]
    const s = computeStats(track, 0, 15_000)
    expect(s.elevationGainMeters).not.toBeNull()
    expect(s.elevationGainMeters!).toBeGreaterThan(0)
  })
})
