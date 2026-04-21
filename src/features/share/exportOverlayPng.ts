import type { Ride, TrackPoint } from '../../types/ride'
import {
  centreOf,
  fitZoomForBounds,
  lngLatToWorldPx,
} from './projection'
import { formatDistance, formatDuration } from '../stats/format'
import { haversine } from '../stats/haversine'

// Same canvas spec as the Story poster so both exports drop into Instagram's
// 1080×1920 Story composer without scaling. The difference: this one keeps
// the canvas fully transparent so a rider can paste it on top of any photo.
const CANVAS_W = 1080
const CANVAS_H = 1920

// Layout zones for the overlay elements. Everything outside these rectangles
// stays 100% transparent on the exported PNG.
const MAP_TOP = 140
const MAP_BOTTOM = 1240
const GRAPH_TOP = 1300
const GRAPH_BOTTOM = 1560
const STATS_Y = 1720

type ExportOpts = {
  ride: Ride
}

/**
 * Render a 1080×1920 *transparent* PNG overlay for a single ride: route line,
 * a minimal speed graph, distance, and duration. Nothing else. Designed to
 * be dropped on top of a rider's own photo in Instagram Stories / any photo
 * editor. Every pixel that isn't route / graph / text is fully transparent.
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
  drawSpeedGraph(ctx, ride.track)
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

  // White halo first so the orange core reads on any photo below — including
  // bright skies and snow-covered mountains.
  ctx.beginPath()
  for (let i = 0; i < track.length; i++) {
    const wp = lngLatToWorldPx(track[i].lng, track[i].lat, zoom)
    const x = wp.x - anchorX
    const y = wp.y - anchorY
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = 22
  ctx.stroke()
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

function drawSpeedGraph(ctx: CanvasRenderingContext2D, track: TrackPoint[]) {
  const samples = smooth(sampleSpeeds(track))
  if (samples.length < 2) return

  const padX = 96
  const graphH = GRAPH_BOTTOM - GRAPH_TOP
  const innerW = CANVAS_W - padX * 2
  const maxMps = Math.max(...samples, 1)
  const maxKmh = Math.ceil((maxMps * 3.6) / 10) * 10 || 10

  const points = samples.map((v, i) => {
    const x = padX + (i / (samples.length - 1)) * innerW
    const y =
      GRAPH_TOP + graphH - ((v * 3.6) / maxKmh) * (graphH - 40) - 20
    return { x, y }
  })

  // Subtle baseline.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 10])
  ctx.beginPath()
  ctx.moveTo(padX, GRAPH_BOTTOM - 20)
  ctx.lineTo(CANVAS_W - padX, GRAPH_BOTTOM - 20)
  ctx.stroke()
  ctx.setLineDash([])

  // Translucent area under the curve.
  ctx.beginPath()
  ctx.moveTo(points[0].x, GRAPH_BOTTOM - 20)
  for (const p of points) ctx.lineTo(p.x, p.y)
  ctx.lineTo(points[points.length - 1].x, GRAPH_BOTTOM - 20)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,77,0,0.22)'
  ctx.fill()

  // White halo under the line so it reads on dark + bright photo subjects.
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 10
  ctx.stroke()
  ctx.strokeStyle = '#ff4d00'
  ctx.lineWidth = 5
  ctx.stroke()
}

function drawStats(ctx: CanvasRenderingContext2D, ride: Ride) {
  const distance = formatDistance(ride.stats.distanceMeters)
  const duration = formatDuration(ride.stats.durationMs)

  // Two big numbers centred — distance on the left, duration on the right.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  const leftX = CANVAS_W * 0.28
  const rightX = CANVAS_W * 0.72
  const valueY = STATS_Y
  const labelY = STATS_Y + 46

  // Drop shadow so white text keeps contrast on any background photo.
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 4

  ctx.font =
    '800 104px "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(distance, leftX, valueY)
  ctx.fillText(duration, rightX, valueY)

  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  ctx.font = '700 26px "Inter", -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('DISTANCE', leftX, labelY)
  ctx.fillText('TIME', rightX, labelY)
}

function sampleSpeeds(track: TrackPoint[]): number[] {
  if (track.length < 2) return []
  const out: number[] = [0]
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]
    const b = track[i]
    if (b.speed != null) {
      out.push(Math.max(0, b.speed))
      continue
    }
    const dt = (b.ts - a.ts) / 1000
    if (dt <= 0) {
      out.push(0)
      continue
    }
    out.push(haversine(a.lat, a.lng, b.lat, b.lng) / dt)
  }
  return out
}

function smooth(values: number[]): number[] {
  return values.map((_, i) => {
    const win = values.slice(
      Math.max(0, i - 2),
      Math.min(values.length, i + 3),
    )
    return win.reduce((s, v) => s + v, 0) / win.length
  })
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
  ctx.arc(x, y, 18, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y, 13, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}
