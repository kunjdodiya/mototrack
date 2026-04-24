import type { Ride, TrackPoint } from '../../types/ride'
import {
  centreOf,
  fitZoomForBounds,
  lngLatToWorldPx,
} from './projection'
import {
  formatDateTime,
  formatDistance,
  formatDuration,
  formatElevation,
  formatLeanAngle,
  formatSpeed,
} from '../stats/format'
import { getBike } from '../storage/bikes'
import { haversine } from '../stats/haversine'
import { drawLogoMark, drawLogoTile } from './logoMark'

// Same 1080×1920 Story layout as `exportPng.ts` and `exportOverlayPng.ts`
// so the three formats drop into Instagram's composer without scaling. The
// difference: this one keeps the canvas fully transparent and renders every
// data module as a frosted-glass panel, so a rider can drop their own photo
// behind the exported PNG and the stats stay readable on top.
const CANVAS_W = 1080
const CANVAS_H = 1920

const PIXEL_RATIO = 2

// Same vertical layout as the Story poster — keeps the two formats visually
// consistent so the rider recognises the same bands of information.
const MAP_TOP = 0
const MAP_BOTTOM = 880

const TITLE_BASELINE_Y = 962
const SUBTITLE_BASELINE_Y = 1010
const BIKE_CHIP_TOP_Y = 1034
const BIKE_CHIP_H = 50

const GRAPH_TOP_Y = 1104
const GRAPH_H = 150

const HERO_TOP_Y = 1280
const HERO_H = 170

const GRID_TOP_Y = 1470
const GRID_TILE_H = 150
const GRID_GAP = 20
const GRID_COLS = 3

const PAD_X = 72
const TILE_GAP = 20
const BOTTOM_LOGO_CENTER_Y = 1843
const FOOTER_BASELINE_Y = 1896

type ExportOpts = {
  ride: Ride
}

/**
 * Render a 1080×1920 *transparent* glass poster for a ride: every data module
 * (map route, title, bike chip, speed graph, stats grid, footer logo) paints
 * as a frosted-glass panel with crisp text on top, while the rest of the
 * canvas stays fully transparent. Designed to be composited over a rider's
 * own photo in Instagram Stories / any photo editor.
 *
 * Implementation notes:
 *   - No map tiles. The route line + start/end dots float on the photo.
 *   - "Frosted" is emulated with a translucent white fill + top highlight +
 *     bright inner-top border. A real backdrop blur needs a backdrop to blur,
 *     which a PNG doesn't have — this is the closest visual approximation.
 *   - All text carries a soft drop shadow so white/gradient copy stays
 *     readable on any background photo.
 */
export async function renderGlassPng({ ride }: ExportOpts): Promise<Blob> {
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

  const bikeName = ride.bikeId ? (await getBike(ride.bikeId))?.name ?? null : null

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W * PIXEL_RATIO
  canvas.height = CANVAS_H * PIXEL_RATIO
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')

  ctx.scale(PIXEL_RATIO, PIXEL_RATIO)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Leave the canvas transparent — every untouched pixel must stay fully
  // transparent so the rider's photo shows through.

  drawRoute(ctx, ride.track)
  drawTitle(ctx, ride, bikeName)
  drawSpeedGraph(ctx, ride.track)
  drawStats(ctx, ride)
  drawBottomLogo(ctx)
  drawFooter(ctx)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob returned null'))
    }, 'image/png')
  })
}

// ── map hero — route only, no tiles ─────────────────────────────────────────

function drawRoute(ctx: CanvasRenderingContext2D, track: TrackPoint[]) {
  const mapW = CANVAS_W
  const mapH = MAP_BOTTOM - MAP_TOP

  const pts = track.map((p) => ({ lat: p.lat, lng: p.lng }))
  const zoom = fitZoomForBounds(pts, mapW, mapH, 140)
  const centre = centreOf(pts)
  const centreWorld = lngLatToWorldPx(centre.lng, centre.lat, zoom)
  const anchorX = centreWorld.x - mapW / 2
  const anchorY = centreWorld.y - mapH / 2

  ctx.save()
  ctx.translate(0, MAP_TOP)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Dark halo under the orange core so the route reads on bright photos too.
  ctx.beginPath()
  for (let i = 0; i < track.length; i++) {
    const wp = lngLatToWorldPx(track[i].lng, track[i].lat, zoom)
    const x = wp.x - anchorX
    const y = wp.y - anchorY
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 16
  ctx.stroke()

  ctx.beginPath()
  for (let i = 0; i < track.length; i++) {
    const wp = lngLatToWorldPx(track[i].lng, track[i].lat, zoom)
    const x = wp.x - anchorX
    const y = wp.y - anchorY
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = '#ff4d00'
  ctx.lineWidth = 10
  ctx.stroke()

  drawDot(ctx, track[0], zoom, anchorX, anchorY, '#22c55e')
  drawDot(ctx, track[track.length - 1], zoom, anchorX, anchorY, '#ef4444')

  ctx.restore()
}

// ── title block ────────────────────────────────────────────────────────────

function drawTitle(
  ctx: CanvasRenderingContext2D,
  ride: Ride,
  bikeName: string | null,
) {
  const titleText = ride.name ?? formatDateTime(ride.startedAt)
  const subtitleText = ride.name ? formatDateTime(ride.startedAt) : null

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // Drop shadow keeps the gradient title readable on bright photos.
  withTextShadow(ctx, () => {
    ctx.font = '800 66px "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, sans-serif'
    const titleGrad = ctx.createLinearGradient(
      PAD_X,
      TITLE_BASELINE_Y - 60,
      PAD_X + 800,
      TITLE_BASELINE_Y,
    )
    titleGrad.addColorStop(0, '#ff4d00')
    titleGrad.addColorStop(0.55, '#ff2d87')
    titleGrad.addColorStop(1, '#7c3aed')
    ctx.fillStyle = titleGrad
    fillTextTruncated(ctx, titleText, PAD_X, TITLE_BASELINE_Y, CANVAS_W - PAD_X * 2)

    if (subtitleText) {
      ctx.font = '500 26px "Inter", -apple-system, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.fillText(subtitleText, PAD_X, SUBTITLE_BASELINE_Y)
    }
  })

  if (bikeName) {
    const label = `🏍  ${bikeName}`
    ctx.font = '600 22px "Inter", -apple-system, sans-serif'
    const pad = 20
    const textW = ctx.measureText(label).width
    const chipW = textW + pad * 2
    drawGlassPanel(ctx, PAD_X, BIKE_CHIP_TOP_Y, chipW, BIKE_CHIP_H, BIKE_CHIP_H / 2)
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'
    withTextShadow(ctx, () => {
      ctx.fillText(label, PAD_X + pad, BIKE_CHIP_TOP_Y + BIKE_CHIP_H / 2)
    })
    ctx.textBaseline = 'alphabetic'
  }
}

// ── speed graph in a glass panel ────────────────────────────────────────────

function drawSpeedGraph(ctx: CanvasRenderingContext2D, track: TrackPoint[]) {
  const x = PAD_X
  const y = GRAPH_TOP_Y
  const w = CANVAS_W - PAD_X * 2
  const h = GRAPH_H

  drawGlassPanel(ctx, x, y, w, h, 26)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  withTextShadow(ctx, () => {
    ctx.font = '700 18px "Inter", -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText('SPEED  ·  KM/H OVER DISTANCE', x + 24, y + 32)
  })

  const samples = smoothSpeeds(sampleSpeeds(track))
  if (samples.length < 2) {
    ctx.textAlign = 'center'
    ctx.font = '500 20px "Inter", -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    withTextShadow(ctx, () => {
      ctx.fillText('Not enough data for a speed graph.', x + w / 2, y + h / 2 + 8)
    })
    return
  }

  const maxMps = Math.max(...samples, 1)
  const maxKmh = Math.ceil((maxMps * 3.6) / 10) * 10 || 10

  ctx.textAlign = 'right'
  withTextShadow(ctx, () => {
    ctx.font = '800 22px "Space Grotesk", "Inter", -apple-system, sans-serif'
    ctx.fillStyle = '#ff4d00'
    ctx.fillText(`${Math.round(maxKmh)} km/h`, x + w - 24, y + 32)
  })

  const padL = 56
  const padR = 20
  const padT = 52
  const padB = 22
  const innerX = x + padL
  const innerY = y + padT
  const innerW = w - padL - padR
  const innerH = h - padT - padB

  const ticks = [0, maxKmh / 2, maxKmh]
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.font = '500 14px "Inter", -apple-system, sans-serif'
  for (const k of ticks) {
    const ty = innerY + innerH - (k / maxKmh) * innerH
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(innerX, ty)
    ctx.lineTo(innerX + innerW, ty)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    withTextShadow(ctx, () => {
      ctx.fillText(String(Math.round(k)), innerX - 8, ty)
    })
  }
  ctx.textBaseline = 'alphabetic'

  const points = samples.map((v, i) => {
    const px = innerX + (i / (samples.length - 1)) * innerW
    const kmh = v * 3.6
    const py = innerY + innerH - (kmh / maxKmh) * innerH
    return { x: px, y: py }
  })

  ctx.beginPath()
  ctx.moveTo(points[0].x, innerY + innerH)
  for (const p of points) ctx.lineTo(p.x, p.y)
  ctx.lineTo(points[points.length - 1].x, innerY + innerH)
  ctx.closePath()
  const areaGrad = ctx.createLinearGradient(0, innerY, 0, innerY + innerH)
  areaGrad.addColorStop(0, 'rgba(255,77,0,0.45)')
  areaGrad.addColorStop(1, 'rgba(255,77,0,0.04)')
  ctx.fillStyle = areaGrad
  ctx.fill()

  ctx.beginPath()
  for (let i = 0; i < points.length; i++) {
    if (i === 0) ctx.moveTo(points[i].x, points[i].y)
    else ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.strokeStyle = '#ff4d00'
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
}

// ── stats grid ──────────────────────────────────────────────────────────────

type StatCell = {
  label: string
  value: string
}

function drawStats(ctx: CanvasRenderingContext2D, ride: Ride) {
  const { stats } = ride

  const hero: StatCell[] = [
    { label: 'DISTANCE', value: formatDistance(stats.distanceMeters) },
    { label: 'TOP SPEED', value: formatSpeed(stats.maxSpeedMps) },
  ]
  const grid: StatCell[] = [
    { label: 'Duration', value: formatDuration(stats.durationMs) },
    { label: 'Avg speed', value: formatSpeed(stats.avgSpeedMps) },
    { label: 'Max lean', value: formatLeanAngle(stats.maxLeanAngleDeg) },
    { label: 'Moving', value: formatDuration(stats.movingDurationMs) },
    { label: 'Idle', value: formatDuration(stats.idleDurationMs) },
    { label: 'Elev gain', value: formatElevation(stats.elevationGainMeters) },
  ]

  const heroW = (CANVAS_W - PAD_X * 2 - TILE_GAP) / 2
  hero.forEach((cell, i) => {
    const x = PAD_X + i * (heroW + TILE_GAP)
    drawHeroTile(ctx, x, HERO_TOP_Y, heroW, HERO_H, cell)
  })

  const tileW = (CANVAS_W - PAD_X * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
  grid.forEach((cell, i) => {
    const col = i % GRID_COLS
    const row = Math.floor(i / GRID_COLS)
    const x = PAD_X + col * (tileW + GRID_GAP)
    const y = GRID_TOP_Y + row * (GRID_TILE_H + GRID_GAP)
    drawStatTile(ctx, x, y, tileW, GRID_TILE_H, cell)
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
  drawGlassPanel(ctx, x, y, w, h, 30)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  withTextShadow(ctx, () => {
    ctx.font = '700 20px "Inter", -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillText(cell.label, x + 26, y + 46)

    ctx.font = '800 62px "Space Grotesk", "Inter", -apple-system, sans-serif'
    const valueGrad = ctx.createLinearGradient(x, y + h - 70, x + w, y + h - 20)
    valueGrad.addColorStop(0, '#ff4d00')
    valueGrad.addColorStop(0.55, '#ff2d87')
    valueGrad.addColorStop(1, '#7c3aed')
    ctx.fillStyle = valueGrad
    fillTextTruncated(ctx, cell.value, x + 26, y + h - 32, w - 52)
  })
}

function drawStatTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cell: StatCell,
) {
  drawGlassPanel(ctx, x, y, w, h, 24)

  // Brand-gradient accent stripe — same as the Story poster tile.
  const accent = ctx.createLinearGradient(x, y, x + w, y)
  accent.addColorStop(0, '#ff4d00')
  accent.addColorStop(0.55, '#ff2d87')
  accent.addColorStop(1, '#7c3aed')
  ctx.fillStyle = accent
  roundRect(ctx, x + 18, y, w - 36, 3, 2)
  ctx.fill()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  withTextShadow(ctx, () => {
    ctx.font = '700 18px "Inter", -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(cell.label.toUpperCase(), x + 22, y + 46)

    ctx.font = '800 42px "Space Grotesk", "Inter", -apple-system, sans-serif'
    ctx.fillStyle = '#ffffff'
    fillTextTruncated(ctx, cell.value, x + 22, y + h - 30, w - 44)
  })
}

// ── bottom logo + footer ───────────────────────────────────────────────────

function drawBottomLogo(ctx: CanvasRenderingContext2D) {
  const iconSize = 44
  const wordmarkSize = 34
  const gap = 12
  const centerY = BOTTOM_LOGO_CENTER_Y

  ctx.font = `700 ${wordmarkSize}px "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, sans-serif`
  const motoWidth = ctx.measureText('Moto').width
  const trackWidth = ctx.measureText('Track').width
  const totalWidth = iconSize + gap + motoWidth + trackWidth
  const startX = (CANVAS_W - totalWidth) / 2

  const iconX = startX
  const iconY = centerY - iconSize / 2

  // Keep the painted logo tile — it's opaque-enough to read on any photo and
  // matches the brand mark exactly. (The tile already has ambient glows built
  // in so it reads without an extra glass panel.)
  drawLogoTile(ctx, iconX, iconY, iconSize, 11)
  drawLogoMark(ctx, iconX, iconY, iconSize)

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = `700 ${wordmarkSize}px "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, sans-serif`
  const textX = iconX + iconSize + gap
  withTextShadow(ctx, () => {
    const motoGrad = ctx.createLinearGradient(textX, centerY - 18, textX + motoWidth + 60, centerY + 18)
    motoGrad.addColorStop(0, '#ff4d00')
    motoGrad.addColorStop(0.55, '#ff2d87')
    motoGrad.addColorStop(1, '#7c3aed')
    ctx.fillStyle = motoGrad
    ctx.fillText('Moto', textX, centerY)
    ctx.fillStyle = '#ffffff'
    ctx.fillText('Track', textX + motoWidth, centerY)
  })
  ctx.textBaseline = 'alphabetic'
}

function drawFooter(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  withTextShadow(ctx, () => {
    ctx.font = '500 18px "Inter", -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText('mototrack.app', CANVAS_W / 2, FOOTER_BASELINE_Y)
  })
}

// ── primitives ──────────────────────────────────────────────────────────────

/**
 * Paint a frosted-glass rectangle: a soft translucent fill with a top-down
 * highlight, a bright inner border at the top edge, and a thin outer stroke.
 * Emulates a backdrop-blur panel without needing an actual backdrop to blur.
 */
function drawGlassPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  // Translucent white fill — light enough to let the photo show through, dense
  // enough that text on top still reads.
  roundRect(ctx, x, y, w, h, r)
  const fill = ctx.createLinearGradient(x, y, x, y + h)
  fill.addColorStop(0, 'rgba(255,255,255,0.18)')
  fill.addColorStop(1, 'rgba(255,255,255,0.08)')
  ctx.fillStyle = fill
  ctx.fill()

  // Outer stroke defines the panel edge on busy photos.
  roundRect(ctx, x, y, w, h, r)
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Inner highlight at the very top — sells the "glass" look.
  ctx.save()
  roundRect(ctx, x, y, w, h, r)
  ctx.clip()
  const highlight = ctx.createLinearGradient(x, y, x, y + 2)
  highlight.addColorStop(0, 'rgba(255,255,255,0.55)')
  highlight.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = highlight
  ctx.fillRect(x, y, w, 2)
  ctx.restore()
}

/**
 * Run a text-drawing callback with a soft drop shadow so white / gradient
 * copy stays readable on any background photo. Canvas shadows apply to every
 * fill/stroke inside the callback, so we restore state after.
 */
function withTextShadow(
  ctx: CanvasRenderingContext2D,
  draw: () => void,
) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 2
  draw()
  ctx.restore()
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

function smoothSpeeds(values: number[]): number[] {
  return values.map((_, i) => {
    const win = values.slice(Math.max(0, i - 2), Math.min(values.length, i + 3))
    return win.reduce((s, v) => s + v, 0) / win.length
  })
}
