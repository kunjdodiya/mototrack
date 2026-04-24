import type { Ride, TrackPoint } from '../../types/ride'
import {
  centreOf,
  fitZoomForBounds,
  lngLatToWorldPx,
} from './projection'
import { formatDistance, formatDuration, formatSpeed } from '../stats/format'

// Same canvas spec as the Story poster so both exports drop into Instagram's
// 1080×1920 Story composer without scaling. The difference: this one keeps
// the canvas fully transparent so a rider can paste it on top of any photo.
const CANVAS_W = 1080
const CANVAS_H = 1920

// Layout zones for the overlay elements. Everything outside these rectangles
// stays 100% transparent on the exported PNG.
const MAP_TOP = 140
const MAP_BOTTOM = 1560
const STATS_Y = 1720

type ExportOpts = {
  ride: Ride
}

/**
 * Render a 1080×1920 *transparent* PNG overlay for a single ride: route line
 * and three headline numbers (moving time, distance, avg speed). Nothing else.
 * Designed to be dropped on top of a rider's own photo in Instagram Stories /
 * any photo editor. Every pixel that isn't route / text is fully transparent.
 */
export async function renderOverlayPng({ ride }: ExportOpts): Promise<Blob> {
  if (ride.track.length < 2) {
    throw new Error('Ride has no route to render')
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

  // Leave the canvas transparent — do NOT fill with any background.

  drawRoute(ctx, ride.track)
  drawStats(ctx, ride)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob returned null'))
    }, 'image/png')
  })
}

function drawRoute(ctx: CanvasRenderingContext2D, track: TrackPoint[]) {
  const mapW = CANVAS_W
  const mapH = MAP_BOTTOM - MAP_TOP

  const pts = track.map((p) => ({ lat: p.lat, lng: p.lng }))
  const zoom = fitZoomForBounds(pts, mapW, mapH, 120)
  const centre = centreOf(pts)
  const centreWorld = lngLatToWorldPx(centre.lng, centre.lat, zoom)
  const anchorX = centreWorld.x - mapW / 2
  const anchorY = centreWorld.y - mapH / 2

  ctx.save()
  ctx.translate(0, MAP_TOP)

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  for (let i = 0; i < track.length; i++) {
    const wp = lngLatToWorldPx(track[i].lng, track[i].lat, zoom)
    const x = wp.x - anchorX
    const y = wp.y - anchorY
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = '#ff4d00'
  ctx.lineWidth = 12
  ctx.stroke()

  // Start + end dots.
  const first = track[0]
  const last = track[track.length - 1]
  drawDot(ctx, first, zoom, anchorX, anchorY, '#22c55e')
  drawDot(ctx, last, zoom, anchorX, anchorY, '#ef4444')

  ctx.restore()
}

function drawStats(ctx: CanvasRenderingContext2D, ride: Ride) {
  const movingTime = formatDuration(ride.stats.movingDurationMs)
  const distance = formatDistance(ride.stats.distanceMeters)
  const avgSpeed = formatSpeed(ride.stats.avgSpeedMps)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  const columnXs = [CANVAS_W * 0.16, CANVAS_W * 0.5, CANVAS_W * 0.84]
  const valueY = STATS_Y
  const labelY = STATS_Y + 44

  // Drop shadow so white text keeps contrast on any background photo.
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
