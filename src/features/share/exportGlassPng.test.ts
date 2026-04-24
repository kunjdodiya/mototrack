import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderGlassPng } from './exportGlassPng'
import type { Ride } from '../../types/ride'

function makeRide(pointCount: number): Ride {
  const track = Array.from({ length: pointCount }, (_, i) => ({
    lat: 37.7749 + i * 0.0005,
    lng: -122.4194 + i * 0.0005,
    ts: 1_700_000_000_000 + i * 1_000,
    speed: 12,
    alt: 20,
    acc: 5,
  }))
  return {
    id: 'glass-ride',
    deviceId: 'd',
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_000_000 + pointCount * 1_000,
    track,
    stats: {
      distanceMeters: 12_000,
      durationMs: 3_600_000,
      movingDurationMs: 3_200_000,
      idleDurationMs: 400_000,
      avgSpeedMps: 10,
      maxSpeedMps: 20,
      maxLeanAngleDeg: 28,
      elevationGainMeters: 180,
    },
    syncedAt: null,
  }
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

describe('renderGlassPng', () => {
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

  it('throws when the ride has no route', async () => {
    await expect(renderGlassPng({ ride: makeRide(1) })).rejects.toThrow(
      /no route/i,
    )
  })

  it('produces a 1080×1920 PNG blob (rendered at 2× physical pixels)', async () => {
    const createElementSpy = vi.spyOn(document, 'createElement')
    const ride = makeRide(30)

    const blob = await renderGlassPng({ ride })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')

    const canvases = createElementSpy.mock.results
      .map((r) => r.value as HTMLElement)
      .filter((el): el is HTMLCanvasElement => el instanceof HTMLCanvasElement)
    const storyCanvas = canvases.find(
      (c) => c.width === 2160 && c.height === 3840,
    )
    expect(storyCanvas).toBeDefined()
  })
})
