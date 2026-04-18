import { describe, it, expect } from 'vitest'
import { maxLeanAngleDeg } from './leanAngle'
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

describe('maxLeanAngleDeg', () => {
  it('returns null for fewer than 3 points', () => {
    expect(maxLeanAngleDeg([])).toBeNull()
    expect(maxLeanAngleDeg([pt(), pt()])).toBeNull()
  })

  it('returns null for a straight line at any speed', () => {
    const track: TrackPoint[] = []
    for (let i = 0; i < 20; i++) {
      track.push(pt({ lat: 0, lng: i * 0.0001, ts: i * 1_000, speed: 15 }))
    }
    expect(maxLeanAngleDeg(track)).toBeNull()
  })

  it('returns a positive lean angle for a tight arc at realistic speed', () => {
    // ~20m radius corner traversed in ~4s at ~15 m/s (50 km/h) — this is the
    // kind of corner where a rider is actually leaned over. Matching speed
    // and arc geometry so the physics is internally consistent.
    const track: TrackPoint[] = []
    const centreLat = 20
    const centreLng = 73
    const radiusDeg = 0.00018
    for (let i = 0; i < 40; i++) {
      const theta = (i / 40) * Math.PI
      track.push(
        pt({
          lat: centreLat + radiusDeg * Math.cos(theta),
          lng: centreLng + radiusDeg * Math.sin(theta),
          ts: i * 100,
          speed: 15,
        }),
      )
    }
    const lean = maxLeanAngleDeg(track)
    expect(lean).not.toBeNull()
    expect(lean!).toBeGreaterThan(15)
    expect(lean!).toBeLessThanOrEqual(55)
  })

  it('ignores low-speed noise', () => {
    const track: TrackPoint[] = []
    for (let i = 0; i < 10; i++) {
      track.push(pt({ lat: Math.sin(i) * 0.00001, lng: Math.cos(i) * 0.00001, ts: i * 1_000, speed: 0.5 }))
    }
    expect(maxLeanAngleDeg(track)).toBeNull()
  })
})
