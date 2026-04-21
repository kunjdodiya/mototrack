import type { Ride, TrackPoint } from '../../types/ride'
import {
  TILE_SIZE,
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

// Instagram Stories are 9:16 at 1080×1920. Using the exact spec makes the
// exported PNG drop straight into a Story without being letterboxed.
const CANVAS_W = 1080
const CANVAS_H = 1920

// Vertical layout — fixed pixel y-coordinates so every block has a guaranteed
// home inside the 1920-tall canvas. Tweak here to rebalance the poster; every
// drawer below reads from these constants.
const MAP_TOP = 0
const MAP_BOTTOM = 880
const STATS_TOP = 880

const TITLE_BASELINE_Y = 962
const SUBTITLE_BASELINE_Y = 1010
const BIKE_CHIP_TOP_Y = 1034
const BIKE_CHIP_H = 50

const GRAPH_TOP_Y = 1104
const GRAPH_H = 150

const HERO_TOP_Y = 1280
const HERO_H = 170

const GRID_TOP_Y = 1470
const GRID_TILE_H = 160
const GRID_GAP = 20
const GRID_COLS = 3

const PAD_X = 72
const TILE_GAP = 20
const FOOTER_BASELINE_Y = 1880

type ExportOpts = {
  ride: Ride
}

/**
 * Render an Instagram-Story-sized share image (1080×1920) for the given ride.
 * Returns a PNG Blob.
 *
 * Why this compositor exists: html-to-image on a live Leaflet map taints the
 * canvas on Safari. Instead we fetch OSM tiles via fetch() + createImageBitmap
 * (guaranteed CORS-clean), draw them ourselves, and project the track with our
 * own Web Mercator math. Everything — logo, headings, speed graph, stats —
 * is drawn directly onto the canvas so the whole thing is a single paint path.
 */
export async function renderSharePng({ ride }: ExportOpts): Promise<Blob> {
  if (ride.track.length < 2) {
    throw new Error('Ride has no route to render')
  }

  // Wait for Inter / Space Grotesk to be loaded by the browser before we
  // paint — otherwise canvas falls back to the system sans and the poster
  // looks off. document.fonts.ready resolves once every declared @font-face
  // has finished loading (no-op in test/jsdom which lacks fonts anyway).
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready
    } catch {
      // non-fatal
    }
  }

  const bikeName = ride.bikeId ? (await getBike(ride.bikeId))?.name ?? null : null

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')

  // Paint the deep-black base first. Any unrendered pixel falls through to
  // this, so the overall frame stays coherent on slow tile loads.
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  await drawMapHero(ctx, ride)
  drawBrandOverlay(ctx)
  drawHeaderLogo(ctx)
  drawTitle(ctx, ride, bikeName)
  drawSpeedGraph(ctx, ride.track)
  drawStats(ctx, ride)
  drawFooter(ctx)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob returned null'))
    }, 'image/png')
  })
}

// ── map hero ────────────────────────────────────────────────────────────────

async function drawMapHero(ctx: CanvasRenderingContext2D, ride: Ride) {
  const mapH = MAP_BOTTOM - MAP_TOP

  const routePts = ride.track.map((p) => ({ lat: p.lat, lng: p.lng }))
  const zoom = fitZoomForBounds(routePts, CANVAS_W, mapH, 140)
  const centre = centreOf(routePts)
  const centreWorld = lngLatToWorldPx(centre.lng, centre.lat, zoom)

  const anchorX = centreWorld.x - CANVAS_W / 2
  const anchorY = centreWorld.y - mapH / 2

  const tileMinX = Math.floor(anchorX / TILE_SIZE)
  const tileMaxX = Math.floor((anchorX + CANVAS_W) / TILE_SIZE)
  const tileMinY = Math.floor(anchorY / TILE_SIZE)
  const tileMaxY = Math.floor((anchorY + mapH) / TILE_SIZE)

  // Draw tiles into a dedicated off-screen canvas so we can desaturate /
  // darken the map without touching the rest of the compositor.
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

  // Light violet multiply tints the already-dark CARTO tiles toward the brand
  // palette without crushing road/label detail to pure black.
  mctx.globalCompositeOperation = 'multiply'
  mctx.fillStyle = 'rgba(60,40,90,0.55)'
  mctx.fillRect(0, 0, CANVAS_W, mapH)
  mctx.globalCompositeOperation = 'source-over'

  // Route: white halo under a bright orange core for legibility on any tile.
  mctx.lineCap = 'round'
  mctx.lineJoin = 'round'
  mctx.beginPath()
  for (let i = 0; i < ride.track.length; i++) {
    const p = ride.track[i]
    const wp = lngLatToWorldPx(p.lng, p.lat, zoom)
    const x = wp.x - anchorX
    const y = wp.y - anchorY
    if (i === 0) mctx.moveTo(x, y)
    else mctx.lineTo(x, y)
  }
  mctx.strokeStyle = 'rgba(255,255,255,0.9)'
  mctx.lineWidth = 14
  mctx.stroke()
  mctx.strokeStyle = '#ff4d00'
  mctx.lineWidth = 8
  mctx.stroke()

  drawDot(mctx, ride.track[0], zoom, anchorX, anchorY, '#22c55e')
  drawDot(
    mctx,
    ride.track[ride.track.length - 1],
    zoom,
    anchorX,
    anchorY,
    '#ef4444',
  )

  ctx.drawImage(mapCanvas, 0, MAP_TOP)
}

// ── brand + atmospheric overlays ────────────────────────────────────────────

function drawBrandOverlay(ctx: CanvasRenderingContext2D) {
  const mapH = MAP_BOTTOM - MAP_TOP

  // Warm brand wash over the map — orange → magenta → violet diagonal.
  const warm = ctx.createLinearGradient(0, 0, CANVAS_W, mapH)
  warm.addColorStop(0, 'rgba(255,77,0,0.38)')
  warm.addColorStop(0.55, 'rgba(255,45,135,0.34)')
  warm.addColorStop(1, 'rgba(124,58,237,0.42)')
  ctx.fillStyle = warm
  ctx.fillRect(0, MAP_TOP, CANVAS_W, mapH)

  // Extra orange glow concentrated in the top-left behind the logo so the
  // header pops without an opaque bar.
  const topGlow = ctx.createRadialGradient(300, 240, 40, 300, 240, 900)
  topGlow.addColorStop(0, 'rgba(255,77,0,0.55)')
  topGlow.addColorStop(1, 'rgba(255,77,0,0)')
  ctx.fillStyle = topGlow
  ctx.fillRect(0, 0, CANVAS_W, mapH)

  // Dim the top 240px a touch so the logo reads cleanly against busy tiles.
  const topFade = ctx.createLinearGradient(0, 0, 0, 320)
  topFade.addColorStop(0, 'rgba(10,10,10,0.55)')
  topFade.addColorStop(1, 'rgba(10,10,10,0)')
  ctx.fillStyle = topFade
  ctx.fillRect(0, 0, CANVAS_W, 320)

  // Fade the bottom of the map into the stats panel so the title reads on
  // solid black.
  const fadeH = 200
  const bottomFade = ctx.createLinearGradient(0, mapH - fadeH, 0, mapH)
  bottomFade.addColorStop(0, 'rgba(10,10,10,0)')
  bottomFade.addColorStop(1, 'rgba(10,10,10,1)')
  ctx.fillStyle = bottomFade
  ctx.fillRect(0, mapH - fadeH, CANVAS_W, fadeH)

  // Solid base for the stats panel below the map.
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, STATS_TOP, CANVAS_W, CANVAS_H - STATS_TOP)

  // Subtle magenta→violet glow behind the stats section for modernity.
  const statsGlow = ctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H - 280,
    80,
    CANVAS_W / 2,
    CANVAS_H - 280,
    900,
  )
  statsGlow.addColorStop(0, 'rgba(124,58,237,0.22)')
  statsGlow.addColorStop(1, 'rgba(124,58,237,0)')
  ctx.fillStyle = statsGlow
  ctx.fillRect(0, STATS_TOP, CANVAS_W, CANVAS_H - STATS_TOP)
}

// ── header: logo + wordmark ─────────────────────────────────────────────────

function drawHeaderLogo(ctx: CanvasRenderingContext2D) {
  const logoX = PAD_X
  const logoY = 130
  const logoSize = 84

  // Rounded black tile matching the app icon.
  roundRect(ctx, logoX, logoY, logoSize, logoSize, 22)
  ctx.fillStyle = '#0a0a0a'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.stroke()

  // Mini elevation-plot mark (matches public/icon-512.svg).
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

  // "MotoTrack" wordmark.
  const textX = logoX + logoSize + 22
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = '700 48px "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#ff4d00'
  ctx.fillText('Moto', textX, logoY + logoSize / 2 - 8)
  const motoWidth = ctx.measureText('Moto').width
  ctx.fillStyle = '#ffffff'
  ctx.fillText('Track', textX + motoWidth, logoY + logoSize / 2 - 8)

  // "RIDE · RECAP" eyebrow.
  ctx.font = '600 20px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('RIDE  ·  RECAP', textX, logoY + logoSize / 2 + 26)
}

// ── title block ─────────────────────────────────────────────────────────────

function drawTitle(
  ctx: CanvasRenderingContext2D,
  ride: Ride,
  bikeName: string | null,
) {
  const titleText = ride.name ?? formatDateTime(ride.startedAt)
  const subtitleText = ride.name ? formatDateTime(ride.startedAt) : null

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // Big title in gradient.
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
    ctx.fillStyle = 'rgba(255,255,255,0.68)'
    ctx.fillText(subtitleText, PAD_X, SUBTITLE_BASELINE_Y)
  }

  if (bikeName) {
    const label = `🏍  ${bikeName}`
    ctx.font = '600 22px "Inter", -apple-system, sans-serif'
    const pad = 20
    const textW = ctx.measureText(label).width
    const chipW = textW + pad * 2
    roundRect(ctx, PAD_X, BIKE_CHIP_TOP_Y, chipW, BIKE_CHIP_H, BIKE_CHIP_H / 2)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = '#f5f5f5'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, PAD_X + pad, BIKE_CHIP_TOP_Y + BIKE_CHIP_H / 2)
    ctx.textBaseline = 'alphabetic'
  }
}

// ── speed graph ─────────────────────────────────────────────────────────────

function drawSpeedGraph(ctx: CanvasRenderingContext2D, track: TrackPoint[]) {
  const x = PAD_X
  const y = GRAPH_TOP_Y
  const w = CANVAS_W - PAD_X * 2
  const h = GRAPH_H

  // Panel background so the graph reads as a dedicated module.
  roundRect(ctx, x, y, w, h, 26)
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Label in top-left.
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '700 18px "Inter", -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText('SPEED  ·  KM/H OVER DISTANCE', x + 24, y + 32)

  const samples = smoothSpeeds(sampleSpeeds(track))
  if (samples.length < 2) {
    ctx.textAlign = 'center'
    ctx.font = '500 20px "Inter", -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fillText('Not enough data for a speed graph.', x + w / 2, y + h / 2 + 8)
    return
  }

  const maxMps = Math.max(...samples, 1)
  const maxKmh = Math.ceil((maxMps * 3.6) / 10) * 10 || 10

  // Max value callout in top-right.
  ctx.textAlign = 'right'
  ctx.font = '800 22px "Space Grotesk", "Inter", -apple-system, sans-serif'
  ctx.fillStyle = '#ff4d00'
  ctx.fillText(`${Math.round(maxKmh)} km/h`, x + w - 24, y + 32)

  // Inner plot rectangle (leaves room for the label row + y-ticks on left).
  const padL = 56
  const padR = 20
  const padT = 52
  const padB = 22
  const innerX = x + padL
  const innerY = y + padT
  const innerW = w - padL - padR
  const innerH = h - padT - padB

  // Y-ticks at 0, max/2, max.
  const ticks = [0, maxKmh / 2, maxKmh]
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.font = '500 14px "Inter", -apple-system, sans-serif'
  for (const k of ticks) {
    const ty = innerY + innerH - (k / maxKmh) * innerH
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(innerX, ty)
    ctx.lineTo(innerX + innerW, ty)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText(String(Math.round(k)), innerX - 8, ty)
  }
  ctx.textBaseline = 'alphabetic'

  // Build the path.
  const points = samples.map((v, i) => {
    const px = innerX + (i / (samples.length - 1)) * innerW
    const kmh = v * 3.6
    const py = innerY + innerH - (kmh / maxKmh) * innerH
    return { x: px, y: py }
  })

  // Area fill (soft orange).
  ctx.beginPath()
  ctx.moveTo(points[0].x, innerY + innerH)
  for (const p of points) ctx.lineTo(p.x, p.y)
  ctx.lineTo(points[points.length - 1].x, innerY + innerH)
  ctx.closePath()
  const areaGrad = ctx.createLinearGradient(0, innerY, 0, innerY + innerH)
  areaGrad.addColorStop(0, 'rgba(255,77,0,0.35)')
  areaGrad.addColorStop(1, 'rgba(255,77,0,0.02)')
  ctx.fillStyle = areaGrad
  ctx.fill()

  // Stroke.
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

/** Sample speed (m/s) for each track point — uses reported speed else derives it from haversine/Δt. */
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

/** 5-point centered moving average — smooths GPS speed jitter without lag. */
function smoothSpeeds(values: number[]): number[] {
  return values.map((_, i) => {
    const win = values.slice(Math.max(0, i - 2), Math.min(values.length, i + 3))
    return win.reduce((s, v) => s + v, 0) / win.length
  })
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
  roundRect(ctx, x, y, w, h, 30)
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

  ctx.font = '700 20px "Inter", -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.fillText(cell.label, x + 26, y + 46)

  ctx.font = '800 62px "Space Grotesk", "Inter", -apple-system, sans-serif'
  const valueGrad = ctx.createLinearGradient(x, y + h - 70, x + w, y + h - 20)
  valueGrad.addColorStop(0, '#ff4d00')
  valueGrad.addColorStop(0.55, '#ff2d87')
  valueGrad.addColorStop(1, '#7c3aed')
  ctx.fillStyle = valueGrad
  fillTextTruncated(ctx, cell.value, x + 26, y + h - 32, w - 52)
}

function drawStatTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cell: StatCell,
) {
  roundRect(ctx, x, y, w, h, 24)
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Thin accent line at top (brand gradient) for modern feel.
  const accent = ctx.createLinearGradient(x, y, x + w, y)
  accent.addColorStop(0, '#ff4d00')
  accent.addColorStop(0.55, '#ff2d87')
  accent.addColorStop(1, '#7c3aed')
  ctx.fillStyle = accent
  roundRect(ctx, x + 18, y, w - 36, 3, 2)
  ctx.fill()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  ctx.font = '700 18px "Inter", -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText(cell.label.toUpperCase(), x + 22, y + 46)

  ctx.font = '800 42px "Space Grotesk", "Inter", -apple-system, sans-serif'
  ctx.fillStyle = '#f5f5f5'
  fillTextTruncated(ctx, cell.value, x + 22, y + h - 30, w - 44)
}

// ── footer ──────────────────────────────────────────────────────────────────

function drawFooter(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '500 18px "Inter", -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fillText(
    'mototrack.app  ·  © OpenStreetMap contributors · © CARTO',
    CANVAS_W / 2,
    FOOTER_BASELINE_Y,
  )
}

// ── primitives ──────────────────────────────────────────────────────────────

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
    // Swallow — the canvas background shows through for any missing tile.
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

/**
 * Draw text, progressively shrinking the font size if it overflows maxWidth.
 * Prevents long ride names / big km/h values from spilling outside their tile.
 */
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
