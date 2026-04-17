import { describe, it, expect } from 'vitest'
import { haversine } from './haversine'

describe('haversine', () => {
  it('is zero for identical points', () => {
    expect(haversine(19.076, 72.8777, 19.076, 72.8777)).toBe(0)
  })

  it('computes the Mumbai ↔ Delhi great-circle distance within 1%', () => {
    const mumbai = { lat: 19.076, lng: 72.8777 }
    const delhi = { lat: 28.6139, lng: 77.209 }
    const got = haversine(mumbai.lat, mumbai.lng, delhi.lat, delhi.lng)
    const expected = 1_152_000
    expect(Math.abs(got - expected) / expected).toBeLessThan(0.01)
  })

  it('is symmetric (a→b === b→a)', () => {
    const d1 = haversine(12.9716, 77.5946, 19.076, 72.8777)
    const d2 = haversine(19.076, 72.8777, 12.9716, 77.5946)
    expect(d1).toBeCloseTo(d2, 6)
  })

  it('handles the equator 1° longitude step as ~111.1 km', () => {
    const d = haversine(0, 0, 0, 1)
    expect(d).toBeGreaterThan(111_000)
    expect(d).toBeLessThan(112_000)
  })
})
