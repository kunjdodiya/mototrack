import type { Ride } from '../../types/ride'
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

// Instagram Stories are 9:16 at 1080×1920. Using the exact spec makes the
// exported PNG drop straight into a Story without being letterboxed.
const CANVAS_W = 1080
const CANVAS_H = 1920

// Vertical layout zones (y-coordinates on the final canvas).
const MAP_TOP = 0
const MAP_BOTTOM = 1120
const STATS_TOP = 1120

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
 * own Web Mercator math. Everything — logo, headings, stats, tiles — is drawn
 * directly onto the canvas so the whole thing is a single paint path.
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

  // Fade the bottom of the map into the stats panel.
  const bottomFade = ctx.createLinearGradient(0, mapH - 220, 0, mapH)
  bottomFade.addColorStop(0, 'rgba(10,10,10,0)')
  bottomFade.addColorStop(1, 'rgba(10,10,10,1)')
  ctx.fillStyle = bottomFade
  ctx.fillRect(0, mapH - 220, CANVAS_W, 220)

  // Solid base for the stats panel.
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
  const logoX = 72
  const logoY = 140
  const logoSize = 88

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
  ctx.font = '700 52px "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#ff4d00'
  ctx.fillText('Moto', textX, logoY + logoSize / 2 - 4)
  const motoWidth = ctx.measureText('Moto').width
  ctx.fillStyle = '#ffffff'
  ctx.fillText('Track', textX + motoWidth, logoY + logoSize / 2 - 4)

  // "RIDE RECAP" eyebrow.
  ctx.font = '600 22px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('RIDE  ·  RECAP', textX, logoY + logoSize + 24)
}

// ── title block ─────────────────────────────────────────────────────────────

function drawTitle(
  ctx: CanvasRenderingContext2D,
  ride: Ride,
  bikeName: string | null,
) {
  const titleText = ride.name ?? formatDateTime(ride.startedAt)
  const subtitleText = ride.name ? formatDateTime(ride.startedAt) : null

  const titleX = 72
  let y = STATS_TOP + 90

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // Big title in gradient.
  ctx.font = '800 72px "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, sans-serif'
  const titleGrad = ctx.createLinearGradient(titleX, y - 60, titleX + 800, y)
  titleGrad.addColorStop(0, '#ff4d00')
  titleGrad.addColorStop(0.55, '#ff2d87')
  titleGrad.addColorStop(1, '#7c3aed')
  ctx.fillStyle = titleGrad
  fillTextTruncated(ctx, titleText, titleX, y, CANVAS_W - titleX * 2)
  y += 52

  if (subtitleText) {
    ctx.font = '500 28px "Inter", -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.68)'
    ctx.fillText(subtitleText, titleX, y)
    y += 28
  }

  if (bikeName) {
    y += 16
    const label = `🏍  ${bikeName}`
    ctx.font = '600 24px "Inter", -apple-system, sans-serif'
    const pad = 22
    const textW = ctx.measureText(label).width
    const chipW = textW + pad * 2
    const chipH = 52
    roundRect(ctx, titleX, y - chipH + 12, chipW, chipH, chipH / 2)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = '#f5f5f5'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, titleX + pad, y - chipH / 2 + 12)
    ctx.textBaseline = 'alphabetic'
  }
}

// ── stats grid ──────────────────────────────────────────────────────────────

type StatCell = {
  label: string
  value: string
  hero?: boolean
}

function drawStats(ctx: CanvasRenderingContext2D, ride: Ride) {
  const { stats } = ride

  const hero: StatCell[] = [
    { label: 'DISTANCE', value: formatDistance(stats.distanceMeters), hero: true },
    { label: 'TOP SPEED', value: formatSpeed(stats.maxSpeedMps), hero: true },
  ]
  const grid: StatCell[] = [
    { label: 'Duration', value: formatDuration(stats.durationMs) },
    { label: 'Moving', value: formatDuration(stats.movingDurationMs) },
    { label: 'Idle', value: formatDuration(stats.idleDurationMs) },
    { label: 'Avg speed', value: formatSpeed(stats.avgSpeedMps) },
    { label: 'Max lean', value: formatLeanAngle(stats.maxLeanAngleDeg) },
    { label: 'Elev gain', value: formatElevation(stats.elevationGainMeters) },
  ]

  const padX = 72
  const gap = 20
  const heroY = STATS_TOP + 300
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

  ctx.font = '700 20px "Inter", -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText(cell.label.toUpperCase(), x + 24, y + 52)

  ctx.font = '800 48px "Space Grotesk", "Inter", -apple-system, sans-serif'
  ctx.fillStyle = '#f5f5f5'
  fillTextTruncated(ctx, cell.value, x + 24, y + h - 32, w - 48)
}

// ── footer ──────────────────────────────────────────────────────────────────

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
