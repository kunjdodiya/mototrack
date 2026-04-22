import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderTripOverlayPng } from './exportTripOverlayPng'
import type { Ride } from '../../types/ride'
import type { Trip } from '../../types/trip'

function makeRide(id: string, pointCount: number, startedAt = 1_700_000_000_000): Ride {
  const track = Array.from({ length: pointCount }, (_, i) => ({
    lat: 37.7749 + i * 0.0005,
    lng: -122.4194 + i * 0.0005,
    ts: startedAt + i * 1_000,
    speed: 12,
    alt: 20,
    acc: 5,
  }))
  return {
    id,
    deviceId: 'd',
    startedAt,
    endedAt: startedAt + pointCount * 1_000,
    track,
    stats: {
      distanceMeters: 15_000,
      durationMs: 3_600_000,
      movingDurationMs: 3_200_000,
      idleDurationMs: 400_000,
      avgSpeedMps: 10,
      maxSpeedMps: 24,
      maxLeanAngleDeg: 30,
      elevationGainMeters: 200,
    },
    syncedAt: null,
  }
}

const trip: Trip = {
  id: 'trip-1',
  name: 'Ladakh 2026',
  coverColor: 'aurora',
  notes: null,
  createdAt: 0,
  syncedAt: null,
}

function fakeContext(): CanvasRenderingContext2D {
  const fakeGradient = {
    addColorStop: vi.fn(),
  } as unknown as CanvasGradient
  const ctx = new Proxy(
    {},
    {
      get(target, prop: string) {
        if (prop === 'measureText') return () => ({ width: 100 }) as TextMetrics
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
          return () => fakeGradient
        const v = (target as Record<string, unknown>)[prop]
        if (v !== undefined) return v
        return () => undefined
      },
      set(target, prop: string, value) {
        ;(target as Record<string, unknown>)[prop] = value
        return true
      },
    },
  ) as unknown as CanvasRenderingContext2D
  return ctx
}

describe('renderTripOverlayPng', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = function (type: string) {
      if (type === '2d') return fakeContext() as unknown as CanvasRenderingContext2D
      return null
    } as typeof HTMLCanvasElement.prototype.getContext

    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }))
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('throws when no ride has a usable route', async () => {
    await expect(
      renderTripOverlayPng({ trip, rides: [makeRide('r1', 1)] }),
    ).rejects.toThrow(/no rides with routes/i)
  })

  it('produces a 1080×1920 transparent PNG for a two-session trip', async () => {
    const createElementSpy = vi.spyOn(document, 'createElement')
    const rides = [
      makeRide('r1', 30, 1_700_000_000_000),
      makeRide('r2', 30, 1_700_000_000_000 + 86_400_000),
    ]

    const blob = await renderTripOverlayPng({ trip, rides })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')

    const canvases = createElementSpy.mock.results
      .map((r) => r.value as HTMLElement)
      .filter((el): el is HTMLCanvasElement => el instanceof HTMLCanvasElement)
    const storyCanvas = canvases.find(
      (c) => c.width === 1080 && c.height === 1920,
    )
    expect(storyCanvas).toBeDefined()
  })
})
