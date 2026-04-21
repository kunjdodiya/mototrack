import type { Ride } from '../../types/ride'
import type { Trip } from '../../types/trip'
import {
  TILE_SIZE,
  centreOf,
  fitZoomForBounds,
  lngLatToWorldPx,
} from './projection'
import {
  formatDistance,
  formatDuration,
  formatSpeed,
  formatElevation,
  formatLeanAngle,
} from '../stats/format'
import { combineTripStats } from '../trips/combineStats'
import { TRIP_COVER_HEX } from '../trips/covers'

// Same Instagram Story spec as the single-ride share.
const CANVAS_W = 1080
const CANVAS_H = 1920
const MAP_TOP = 0
const MAP_BOTTOM = 1120
const STATS_TOP = 1120

// Per-day palette — matches TripMap so the in-app preview and the exported
// poster show the same colors in the same order.
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
 * Render an Instagram-Story-sized (1080×1920) share image for a trip.
 * Each day's route is drawn in its own color on a single combined map, and
 * the stats panel shows trip-wide totals with a day count hero tile.
 */
export async function renderTripSharePng({
  trip,
  rides,
}: ExportOpts): Promise<Blob> {
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

  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  await drawTripMapHero(ctx, usable)
  drawBrandOverlay(ctx, trip)
  drawHeaderLogo(ctx)
  drawTripTitle(ctx, trip, usable)
  drawTripStats(ctx, usable)
  drawFooter(ctx)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob returned null'))
    }, 'image/png')
  })
}

async function drawTripMapHero(
  ctx: CanvasRenderingContext2D,
  rides: Ride[],
) {
  const mapH = MAP_BOTTOM - MAP_TOP
  const allPoints = rides.flatMap((r) =>
    r.track.map((p) => ({ lat: p.lat, lng: p.lng })),
  )
  const zoom = fitZoomForBounds(allPoints, CANVAS_W, mapH, 160)
  const centre = centreOf(allPoints)
  const centreWorld = lngLatToWorldPx(centre.lng, centre.lat, zoom)

  const anchorX = centreWorld.x - CANVAS_W / 2
  const anchorY = centreWorld.y - mapH / 2

  const tileMinX = Math.floor(anchorX / TILE_SIZE)
  const tileMaxX = Math.floor((anchorX + CANVAS_W) / TILE_SIZE)
  const tileMinY = Math.floor(anchorY / TILE_SIZE)
  const tileMaxY = Math.floor((anchorY + mapH) / TILE_SIZE)

  const mapCanvas = document.createElement('canvas')
  mapCanvas.width = CANVAS_W
  mapCanvas.height = mapH
  const mctx = mapCanvas.getContext('2d')
  if (!mctx) return

  mctx.fillStyle = '#0a0a0a'
  mctx.fillRect(0, 0, CANVAS_W, mapH)

  const tilePromises: Promise<void>[] = []
  for (let tx = tileMinX; tx <= tileMaxX; tx++) {
    for (let ty = tileMinY; ty <= tileMaxY; ty++) {
      tilePromises.push(drawTile(mctx, tx, ty, zoom, anchorX, anchorY))
    }
  }
  await Promise.all(tilePromises)

  mctx.globalCompositeOperation = 'multiply'
  mctx.fillStyle = 'rgba(60,40,90,0.55)'
  mctx.fillRect(0, 0, CANVAS_W, mapH)
  mctx.globalCompositeOperation = 'source-over'

  mctx.lineCap = 'round'
  mctx.lineJoin = 'round'

  // Paint every day's route with a white halo + per-day colored core so the
  // multi-day geometry reads cleanly on the dark map.
  rides.forEach((r, i) => {
    const color = DAY_COLORS[i % DAY_COLORS.length]
    mctx.beginPath()
    for (let j = 0; j < r.track.length; j++) {
      const p = r.track[j]
      const wp = lngLatToWorldPx(p.lng, p.lat, zoom)
      const x = wp.x - anchorX
      const y = wp.y - anchorY
      if (j === 0) mctx.moveTo(x, y)
      else mctx.lineTo(x, y)
    }
    mctx.strokeStyle = 'rgba(255,255,255,0.9)'
    mctx.lineWidth = 14
    mctx.stroke()
    mctx.strokeStyle = color
    mctx.lineWidth = 8
    mctx.stroke()
  })

  // Start dot from the very first ride, end dot from the very last.
  const first = rides[0].track[0]
  const last = rides[rides.length - 1].track[rides[rides.length - 1].track.length - 1]
  drawDot(mctx, first, zoom, anchorX, anchorY, '#22c55e')
  drawDot(mctx, last, zoom, anchorX, anchorY, '#ef4444')

  ctx.drawImage(mapCanvas, 0, MAP_TOP)
}

function drawBrandOverlay(ctx: CanvasRenderingContext2D, trip: Trip) {
  const mapH = MAP_BOTTOM - MAP_TOP
  const stops = TRIP_COVER_HEX[trip.coverColor]

  const warm = ctx.createLinearGradient(0, 0, CANVAS_W, mapH)
  if (stops.length === 3) {
    warm.addColorStop(0, withAlpha(stops[0], 0.38))
    warm.addColorStop(0.5, withAlpha(stops[1], 0.34))
    warm.addColorStop(1, withAlpha(stops[2], 0.42))
  } else {
    warm.addColorStop(0, withAlpha(stops[0], 0.38))
    warm.addColorStop(1, withAlpha(stops[1], 0.42))
  }
  ctx.fillStyle = warm
  ctx.fillRect(0, MAP_TOP, CANVAS_W, mapH)

  const topGlow = ctx.createRadialGradient(300, 240, 40, 300, 240, 900)
  topGlow.addColorStop(0, withAlpha(stops[0], 0.55))
  topGlow.addColorStop(1, withAlpha(stops[0], 0))
  ctx.fillStyle = topGlow
  ctx.fillRect(0, 0, CANVAS_W, mapH)

  const topFade = ctx.createLinearGradient(0, 0, 0, 320)
  topFade.addColorStop(0, 'rgba(10,10,10,0.55)')
  topFade.addColorStop(1, 'rgba(10,10,10,0)')
  ctx.fillStyle = topFade
  ctx.fillRect(0, 0, CANVAS_W, 320)

  const bottomFade = ctx.createLinearGradient(0, mapH - 220, 0, mapH)
  bottomFade.addColorStop(0, 'rgba(10,10,10,0)')
  bottomFade.addColorStop(1, 'rgba(10,10,10,1)')
  ctx.fillStyle = bottomFade
  ctx.fillRect(0, mapH - 220, CANVAS_W, 220)

  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, STATS_TOP, CANVAS_W, CANVAS_H - STATS_TOP)

  const statsGlow = ctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H - 280,
    80,
    CANVAS_W / 2,
    CANVAS_H - 280,
    900,
  )
  statsGlow.addColorStop(0, withAlpha(stops[stops.length - 1], 0.22))
  statsGlow.addColorStop(1, withAlpha(stops[stops.length - 1], 0))
  ctx.fillStyle = statsGlow
  ctx.fillRect(0, STATS_TOP, CANVAS_W, CANVAS_H - STATS_TOP)
}

function drawHeaderLogo(ctx: CanvasRenderingContext2D) {
  const logoX = 72
  const logoY = 140
  const logoSize = 88

  roundRect(ctx, logoX, logoY, logoSize, logoSize, 22)
  ctx.fillStyle = '#0a0a0a'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.stroke()

  ctx.save()
  ctx.translate(logoX, logoY)
  const s = logoSize / 512
  ctx.scale(s, s)
  ctx.strokeStyle = '#ff4d00'
  ctx.lineWidth = 40
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(112, 336)
  ctx.lineTo(192, 176)
  ctx.lineTo(256, 288)
  ctx.lineTo(320, 176)
  ctx.lineTo(400, 336)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(256, 288, 20, 0, Math.PI * 2)
  ctx.fillStyle = '#ff4d00'
  ctx.fill()
  ctx.restore()

  const textX = logoX + logoSize + 22
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font =
    '700 52px "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#ff4d00'
  ctx.fillText('Moto', textX, logoY + logoSize / 2 - 4)
  const motoWidth = ctx.measureText('Moto').width
  ctx.fillStyle = '#ffffff'
  ctx.fillText('Track', textX + motoWidth, logoY + logoSize / 2 - 4)

  ctx.font =
    '600 22px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('MULTI  ·  DAY  ·  TRIP', textX, logoY + logoSize + 24)
}

function drawTripTitle(
  ctx: CanvasRenderingContext2D,
  trip: Trip,
  rides: Ride[],
) {
  const stops = TRIP_COVER_HEX[trip.coverColor]
  const titleX = 72
  let y = STATS_TOP + 90

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  ctx.font =
    '800 72px "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, sans-serif'
  const titleGrad = ctx.createLinearGradient(titleX, y - 60, titleX + 800, y)
  if (stops.length === 3) {
    titleGrad.addColorStop(0, stops[0])
    titleGrad.addColorStop(0.5, stops[1])
    titleGrad.addColorStop(1, stops[2])
  } else {
    titleGrad.addColorStop(0, stops[0])
    titleGrad.addColorStop(1, stops[1])
  }
  ctx.fillStyle = titleGrad
  fillTextTruncated(ctx, trip.name, titleX, y, CANVAS_W - titleX * 2)
  y += 52

  const range = formatDateRange(rides)
  if (range) {
    ctx.font = '500 28px "Inter", -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.68)'
    ctx.fillText(range, titleX, y)
    y += 28
  }

  if (trip.notes) {
    y += 12
    ctx.font = '500 22px "Inter", -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    fillTextTruncated(ctx, trip.notes, titleX, y, CANVAS_W - titleX * 2)
  }
}

type StatCell = { label: string; value: string }

function drawTripStats(ctx: CanvasRenderingContext2D, rides: Ride[]) {
  const combined = combineTripStats(rides)

  const hero: StatCell[] = [
    { label: 'TOTAL DISTANCE', value: formatDistance(combined.distanceMeters) },
    {
      label: `${combined.dayCount} DAY${combined.dayCount === 1 ? '' : 'S'}`,
      value: formatDuration(combined.movingDurationMs),
    },
  ]
  const grid: StatCell[] = [
    { label: 'Elapsed', value: formatDuration(combined.durationMs) },
    { label: 'Idle', value: formatDuration(combined.idleDurationMs) },
    { label: 'Avg speed', value: formatSpeed(combined.avgSpeedMps) },
    { label: 'Top speed', value: formatSpeed(combined.maxSpeedMps) },
    { label: 'Max lean', value: formatLeanAngle(combined.maxLeanAngleDeg) },
    { label: 'Elev gain', value: formatElevation(combined.elevationGainMeters) },
  ]

  const padX = 72
  const gap = 20
  const heroY = STATS_TOP + 320
  const heroH = 220
  const heroW = (CANVAS_W - padX * 2 - gap) / 2

  hero.forEach((cell, i) => {
    const x = padX + i * (heroW + gap)
    drawHeroTile(ctx, x, heroY, heroW, heroH, cell)
  })

  const gridY = heroY + heroH + gap
  const cols = 3
  const tileW = (CANVAS_W - padX * 2 - gap * (cols - 1)) / cols
  const tileH = 180

  grid.forEach((cell, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = padX + col * (tileW + gap)
    const y = gridY + row * (tileH + gap)
    drawStatTile(ctx, x, y, tileW, tileH, cell)
  })
}

function drawHeroTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cell: StatCell,
) {
  roundRect(ctx, x, y, w, h, 32)
  const fill = ctx.createLinearGradient(x, y, x + w, y + h)
  fill.addColorStop(0, 'rgba(255,77,0,0.18)')
  fill.addColorStop(0.55, 'rgba(255,45,135,0.16)')
  fill.addColorStop(1, 'rgba(124,58,237,0.20)')
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  ctx.font = '700 22px "Inter", -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.fillText(cell.label, x + 28, y + 54)

  ctx.font = '800 76px "Space Grotesk", "Inter", -apple-system, sans-serif'
  const valueGrad = ctx.createLinearGradient(x, y + h - 90, x + w, y + h - 30)
  valueGrad.addColorStop(0, '#ff4d00')
  valueGrad.addColorStop(0.55, '#ff2d87')
  valueGrad.addColorStop(1, '#7c3aed')
  ctx.fillStyle = valueGrad
  fillTextTruncated(ctx, cell.value, x + 28, y + h - 38, w - 56)
}

function drawStatTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cell: StatCell,
) {
  roundRect(ctx, x, y, w, h, 26)
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  const accent = ctx.createLinearGradient(x, y, x + w, y)
  accent.addColorStop(0, '#ff4d00')
  accent.addColorStop(0.55, '#ff2d87')
  accent.addColorStop(1, '#7c3aed')
  ctx.fillStyle = accent
  roundRect(ctx, x + 18, y, w - 36, 3, 2)
  ctx.fill()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  ctx.font = '700 20px "Inter", -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText(cell.label.toUpperCase(), x + 24, y + 52)

  ctx.font = '800 48px "Space Grotesk", "Inter", -apple-system, sans-serif'
  ctx.fillStyle = '#f5f5f5'
  fillTextTruncated(ctx, cell.value, x + 24, y + h - 32, w - 48)
}

function drawFooter(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '500 20px "Inter", -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fillText(
    'mototrack.app  ·  © OpenStreetMap contributors · © CARTO',
    CANVAS_W / 2,
    CANVAS_H - 48,
  )
}

async function drawTile(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  z: number,
  anchorX: number,
  anchorY: number,
): Promise<void> {
  const url = `https://basemaps.cartocdn.com/dark_all/${z}/${tx}/${ty}.png`
  const destX = tx * TILE_SIZE - anchorX
  const destY = ty * TILE_SIZE - anchorY
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    ctx.drawImage(bitmap, destX, destY, TILE_SIZE, TILE_SIZE)
    bitmap.close?.()
  } catch {
    // tile missing → dark base shows through
  }
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
  ctx.arc(x, y, 14, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y, 10, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function fillTextTruncated(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  const original = ctx.font
  const match = /(\d+(?:\.\d+)?)px/.exec(original)
  if (!match) {
    ctx.fillText(text, x, y)
    return
  }
  let size = parseFloat(match[1])
  const minSize = Math.max(14, size * 0.55)
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2
    ctx.font = original.replace(/(\d+(?:\.\d+)?)px/, `${size}px`)
  }
  ctx.fillText(text, x, y)
  ctx.font = original
}

function formatDateRange(rides: Ride[]): string | null {
  if (rides.length === 0) return null
  const start = rides.reduce((m, r) => Math.min(m, r.startedAt), Infinity)
  const end = rides.reduce((m, r) => Math.max(m, r.endedAt), -Infinity)
  if (!isFinite(start) || !isFinite(end)) return null
  const s = new Date(start)
  const e = new Date(end)
  const sameDay = s.toDateString() === e.toDateString()
  const sameYear = s.getFullYear() === e.getFullYear()
  const fmtDay = (d: Date) =>
    d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    })
  if (sameDay) return fmtDay(s)
  return `${fmtDay(s)} → ${fmtDay(e)}`
}

function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return hex
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return `rgba(${r},${g},${b},${alpha})`
}
