import type { Ride, TrackPoint } from '../../types/ride'
import type { Trip } from '../../types/trip'
import {
  centreOf,
  fitZoomForBounds,
  lngLatToWorldPx,
} from './projection'
import { formatDistance, formatDuration } from '../stats/format'
import { haversine } from '../stats/haversine'
import { combineTripStats } from '../trips/combineStats'

const CANVAS_W = 1080
const CANVAS_H = 1920
const MAP_TOP = 140
const MAP_BOTTOM = 1240
const GRAPH_TOP = 1300
const GRAPH_BOTTOM = 1560
const STATS_Y = 1720

// Matches TripMap / exportTripPng so the same route keeps the same colors
// across every surface the rider sees it on.
const DAY_COLORS = [
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
 * 1080×1920 transparent PNG overlay for a whole trip: every day's route on
 * one map in per-day colors, a combined speed graph stitched across days,
 * and the two headline numbers (total distance + total moving time).
 * Background is fully transparent so it can sit on top of any photo.
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
  drawTripSpeedGraph(ctx, usable)
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
    const color = DAY_COLORS[i % DAY_COLORS.length]
    ctx.beginPath()
    for (let j = 0; j < r.track.length; j++) {
      const wp = lngLatToWorldPx(r.track[j].lng, r.track[j].lat, zoom)
      const x = wp.x - anchorX
      const y = wp.y - anchorY
      if (j === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'
    ctx.lineWidth = 22
    ctx.stroke()
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

function drawTripSpeedGraph(ctx: CanvasRenderingContext2D, rides: Ride[]) {
  // Stitch every day's track end-to-end so the graph reads as one journey.
  const concatenated: TrackPoint[] = []
  for (const r of rides) concatenated.push(...r.track)

  const samples = smooth(sampleSpeeds(concatenated))
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

  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 10])
  ctx.beginPath()
  ctx.moveTo(padX, GRAPH_BOTTOM - 20)
  ctx.lineTo(CANVAS_W - padX, GRAPH_BOTTOM - 20)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.beginPath()
  ctx.moveTo(points[0].x, GRAPH_BOTTOM - 20)
  for (const p of points) ctx.lineTo(p.x, p.y)
  ctx.lineTo(points[points.length - 1].x, GRAPH_BOTTOM - 20)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,77,0,0.22)'
  ctx.fill()

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

function drawTripStats(ctx: CanvasRenderingContext2D, rides: Ride[]) {
  const combined = combineTripStats(rides)
  const distance = formatDistance(combined.distanceMeters)
  const duration = formatDuration(combined.movingDurationMs)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  const leftX = CANVAS_W * 0.28
  const rightX = CANVAS_W * 0.72
  const valueY = STATS_Y
  const labelY = STATS_Y + 46

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
