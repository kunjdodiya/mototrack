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
  it('accepts the first point', () => {
    expect(shouldAcceptPoint(pt(), null).accept).toBe(true)
  })

  it('rejects very inaccurate fixes', () => {
    const d = shouldAcceptPoint(pt({ acc: 100 }), null)
    expect(d.accept).toBe(false)
  })

  it('rejects jitter when less than 5m from the previous point', () => {
    const prev = pt({ lat: 19.076, lng: 72.8777 })
    const next = pt({ lat: 19.076001, lng: 72.8777 })
    const d = shouldAcceptPoint(next, prev)
    expect(d.accept).toBe(false)
  })

  it('accepts real movement above 5m', () => {
    const prev = pt({ lat: 19.076, lng: 72.8777 })
    const next = pt({ lat: 19.0765, lng: 72.8777 })
    const d = shouldAcceptPoint(next, prev)
    expect(d.accept).toBe(true)
  })

  it('rejects an accuracy collapse when barely moving', () => {
    const prev = pt({ lat: 19.076, lng: 72.8777, acc: 5 })
    const next = pt({ lat: 19.07605, lng: 72.8777, acc: 25 })
    const d = shouldAcceptPoint(next, prev)
    expect(d.accept).toBe(false)
  })
})
