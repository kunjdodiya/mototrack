import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSharePng } from './exportPng'
import type { Ride } from '../../types/ride'

vi.mock('../storage/bikes', () => ({
  getBike: vi.fn(async () => null),
}))

function makeRide(pointCount: number, overrides?: Partial<Ride>): Ride {
  const track = Array.from({ length: pointCount }, (_, i) => ({
    lat: 37.7749 + i * 0.0005,
    lng: -122.4194 + i * 0.0005,
    ts: 1_700_000_000_000 + i * 1_000,
    speed: 12,
    alt: 20,
    acc: 5,
  }))
  return {
    id: 'test-ride-0001',
    deviceId: 'device-xyz',
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_000_000 + pointCount * 1_000,
    track,
    stats: {
      distanceMeters: 45200,
      durationMs: 5_420_000,
      movingDurationMs: 5_000_000,
      idleDurationMs: 420_000,
      avgSpeedMps: 25,
      maxSpeedMps: 36,
      maxLeanAngleDeg: 42,
      elevationGainMeters: 320,
    },
    syncedAt: null,
    name: 'Golden Gate loop',
    ...overrides,
  }
}

/**
 * jsdom ships without a Canvas 2D backend. We stub `getContext` with a
 * spy-able proxy that answers every call with a minimal return (numbers
 * for measureText, null otherwise) so the compositor runs end-to-end.
 */
function fakeContext(): CanvasRenderingContext2D {
  const fakeGradient = {
    addColorStop: vi.fn(),
  } as unknown as CanvasGradient

  const ctx = new Proxy(
    {},
    {
      get(target, prop: string) {
        if (prop === 'measureText') {
          return () => ({ width: 100 }) as TextMetrics
        }
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => fakeGradient
        }
        // Anything mutable (fillStyle, font, strokeStyle, lineWidth, etc.)
        // lands here as a property read/write; return a function for methods,
        // and a getter/setter pair via the Proxy's set trap for fields.
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

describe('renderSharePng', () => {
  const originalFetch = globalThis.fetch
  const originalCreateImageBitmap = globalThis.createImageBitmap

  beforeEach(() => {
    globalThis.fetch = vi.fn(
      async () =>
        ({
          ok: true,
          blob: async () => new Blob([new Uint8Array([0])], { type: 'image/png' }),
        }) as unknown as Response,
    ) as unknown as typeof fetch

    globalThis.createImageBitmap = vi.fn(
      async () =>
        ({ close: vi.fn(), width: 256, height: 256 }) as unknown as ImageBitmap,
    )

    HTMLCanvasElement.prototype.getContext = function (type: string) {
      if (type === '2d') return fakeContext() as unknown as CanvasRenderingContext2D
      return null
    } as typeof HTMLCanvasElement.prototype.getContext

    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }))
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.createImageBitmap = originalCreateImageBitmap
    vi.restoreAllMocks()
  })

  it('throws when the ride has no route', async () => {
    await expect(renderSharePng({ ride: makeRide(1) })).rejects.toThrow(
      /no route/i,
    )
  })

  it('produces a PNG blob sized for Instagram Stories (1080×1920)', async () => {
    const createElementSpy = vi.spyOn(document, 'createElement')
    const ride = makeRide(50)

    const blob = await renderSharePng({ ride })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')

    const canvases = createElementSpy.mock.results
      .map((r) => r.value as HTMLElement)
      .filter(
        (el): el is HTMLCanvasElement => el instanceof HTMLCanvasElement,
      )
    const storyCanvas = canvases.find(
      (c) => c.width === 1080 && c.height === 1920,
    )
    expect(storyCanvas).toBeDefined()
  })
})
