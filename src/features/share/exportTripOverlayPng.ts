import type { Ride } from '../../types/ride'
import type { Trip } from '../../types/trip'
import {
  centreOf,
  fitZoomForBounds,
  lngLatToWorldPx,
} from './projection'
import { formatDistance, formatDuration, formatSpeed } from '../stats/format'
import { combineTripStats } from '../trips/combineStats'

const CANVAS_W = 1080
const CANVAS_H = 1920
const MAP_TOP = 140
const MAP_BOTTOM = 1560
const STATS_Y = 1720

// Matches TripMap / exportTripPng so the same route keeps the same colors
// across every surface the rider sees it on.
const SESSION_COLORS = [
  '#ff4d00',
  '#ff2d87',
  '#7c3aed',
  '#22d3ee',
  '#34d399',
  '#facc15',
  '#fb7185',
  '#60a5fa',
]

type ExportOpts = {
  trip: Trip
  rides: Ride[]
}

/**
 * 1080×1920 transparent PNG overlay for a whole trip: every session's route
 * on one map in per-session colors, plus three headline numbers (total moving
 * time, total distance, trip-wide avg speed). Background is fully transparent
 * so it can sit on top of any photo.
 */
export async function renderTripOverlayPng(
  opts: ExportOpts,
): Promise<Blob> {
  const { rides } = opts
  const usable = rides.filter((r) => r.track.length >= 2)
  if (usable.length === 0) {
    throw new Error('Trip has no rides with routes to render')
  }

  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready
    } catch {
      // non-fatal
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')

  drawTripRoute(ctx, usable)
  drawTripStats(ctx, usable)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob returned null'))
    }, 'image/png')
  })
}

function drawTripRoute(ctx: CanvasRenderingContext2D, rides: Ride[]) {
  const mapW = CANVAS_W
  const mapH = MAP_BOTTOM - MAP_TOP

  const allPts = rides.flatMap((r) =>
    r.track.map((p) => ({ lat: p.lat, lng: p.lng })),
  )
  const zoom = fitZoomForBounds(allPts, mapW, mapH, 120)
  const centre = centreOf(allPts)
  const centreWorld = lngLatToWorldPx(centre.lng, centre.lat, zoom)
  const anchorX = centreWorld.x - mapW / 2
  const anchorY = centreWorld.y - mapH / 2

  ctx.save()
  ctx.translate(0, MAP_TOP)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  rides.forEach((r, i) => {
    const color = SESSION_COLORS[i % SESSION_COLORS.length]
    ctx.beginPath()
    for (let j = 0; j < r.track.length; j++) {
      const wp = lngLatToWorldPx(r.track[j].lng, r.track[j].lat, zoom)
      const x = wp.x - anchorX
      const y = wp.y - anchorY
      if (j === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 12
    ctx.stroke()
  })

  // Start dot from the very first ride, end dot from the very last.
  const first = rides[0].track[0]
  const lastRide = rides[rides.length - 1]
  const last = lastRide.track[lastRide.track.length - 1]
  drawDot(ctx, first, zoom, anchorX, anchorY, '#22c55e')
  drawDot(ctx, last, zoom, anchorX, anchorY, '#ef4444')

  ctx.restore()
}

function drawTripStats(ctx: CanvasRenderingContext2D, rides: Ride[]) {
  const combined = combineTripStats(rides)
  const movingTime = formatDuration(combined.movingDurationMs)
  const distance = formatDistance(combined.distanceMeters)
  const avgSpeed = formatSpeed(combined.avgSpeedMps)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  const columnXs = [CANVAS_W * 0.16, CANVAS_W * 0.5, CANVAS_W * 0.84]
  const valueY = STATS_Y
  const labelY = STATS_Y + 44

  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 4

  ctx.font =
    '800 72px "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(movingTime, columnXs[0], valueY)
  ctx.fillText(distance, columnXs[1], valueY)
  ctx.fillText(avgSpeed, columnXs[2], valueY)

  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  ctx.font = '700 24px "Inter", -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('MOVING', columnXs[0], labelY)
  ctx.fillText('DISTANCE', columnXs[1], labelY)
  ctx.fillText('AVG SPEED', columnXs[2], labelY)
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  p: { lat: number; lng: number },
  z: number,
  anchorX: number,
  anchorY: number,
  color: string,
) {
  const wp = lngLatToWorldPx(p.lng, p.lat, z)
  const x = wp.x - anchorX
  const y = wp.y - anchorY
  ctx.beginPath()
  ctx.arc(x, y, 13, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}
