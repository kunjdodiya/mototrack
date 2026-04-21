import { describe, it, expect } from 'vitest'
import { shouldAcceptPoint } from './smoothing'
import type { TrackPoint } from '../../types/ride'

function pt(overrides: Partial<TrackPoint> = {}): TrackPoint {
  return {
    lat: 19.076,
    lng: 72.8777,
    ts: 0,
    speed: null,
    alt: null,
    acc: 5,
    ...overrides,
  }
}

describe('shouldAcceptPoint', () => {
  it('accepts the first point regardless of accuracy', () => {
    expect(shouldAcceptPoint(pt(), null).accept).toBe(true)
    expect(shouldAcceptPoint(pt({ acc: 500 }), null).accept).toBe(true)
  })

  it('accepts a moderately inaccurate fix (<=100m) when moved >5m', () => {
    const prev = pt({ lat: 19.076, lng: 72.8777, acc: 10 })
    const next = pt({ lat: 19.0765, lng: 72.8777, acc: 80 })
    expect(shouldAcceptPoint(next, prev).accept).toBe(true)
  })

  it('rejects jitter when less than 5m from the previous point', () => {
    const prev = pt({ lat: 19.076, lng: 72.8777 })
    const next = pt({ lat: 19.076001, lng: 72.8777 })
    expect(shouldAcceptPoint(next, prev).accept).toBe(false)
  })

  it('accepts real movement above 5m with good accuracy', () => {
    const prev = pt({ lat: 19.076, lng: 72.8777 })
    const next = pt({ lat: 19.0765, lng: 72.8777 })
    expect(shouldAcceptPoint(next, prev).accept).toBe(true)
  })

  it('accepts very inaccurate fix when the user clearly moved >25m', () => {
    const prev = pt({ lat: 19.076, lng: 72.8777, acc: 20 })
    const next = pt({ lat: 19.077, lng: 72.8777, acc: 400 })
    expect(shouldAcceptPoint(next, prev).accept).toBe(true)
  })

  it('rejects low-accuracy fix that barely moved (looks like cell-tower drift)', () => {
    const prev = pt({ lat: 19.076, lng: 72.8777, acc: 20 })
    const next = pt({ lat: 19.07609, lng: 72.8777, acc: 250 })
    expect(shouldAcceptPoint(next, prev).accept).toBe(false)
  })

  it('rejects an accuracy collapse when barely moving', () => {
    const prev = pt({ lat: 19.076, lng: 72.8777, acc: 5 })
    const next = pt({ lat: 19.07605, lng: 72.8777, acc: 25 })
    expect(shouldAcceptPoint(next, prev).accept).toBe(false)
  })
})
