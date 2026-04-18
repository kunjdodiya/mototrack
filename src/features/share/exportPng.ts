import { toCanvas } from 'html-to-image'
import type { Ride } from '../../types/ride'
import {
  TILE_SIZE,
  centreOf,
  fitZoomForBounds,
  lngLatToWorldPx,
} from './projection'

const CANVAS_W = 1080
// Taller poster: the card now holds a speed graph + 7 stat tiles, so the map
// still needs ~600px to read well.
const CANVAS_H = 1620

type ExportOpts = {
  ride: Ride
  /**
   * A DOM node representing a rendered <ShareCard poster> at 1080px wide.
   * Caller mounts it off-screen, passes the node, unmounts after this
   * resolves. (Keeps the compositor DOM-agnostic.)
   */
  cardNode: HTMLElement
}

/**
 * Render a Strava-style share image for the given ride.
 * Returns a PNG Blob.
 *
 * Why this compositor exists: html-to-image on a live Leaflet map taints the
 * canvas on Safari. Instead we fetch OSM tiles via fetch() + createImageBitmap
 * (guaranteed CORS-clean), draw them ourselves, and project the track with our
 * own Web Mercator math.
 */
export async function renderSharePng({ ride, cardNode }: ExportOpts): Promise<Blob> {
  if (ride.track.length < 2) {
    throw new Error('Ride has no route to render')
  }

  // 1) Rasterize the stats card first so we know how much vertical space it
  //    needs. html-to-image's toCanvas returns a canvas sized to the node.
  const cardCanvas = await toCanvas(cardNode, {
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: '#0a0a0a',
  })
  const cardH = cardCanvas.height
  const mapH = CANVAS_H - cardH + 40 // overlap by 40px for gradient

  // 2) Pick zoom that fits the bounding box in (CANVAS_W × mapH) with padding.
  const routePts = ride.track.map((p) => ({ lat: p.lat, lng: p.lng }))
  const zoom = fitZoomForBounds(routePts, CANVAS_W, mapH, 80)
  const centre = centreOf(routePts)
  const centreWorld = lngLatToWorldPx(centre.lng, centre.lat, zoom)

  // Anchor: world-pixel coordinate of the canvas's top-left corner.
  const anchorX = centreWorld.x - CANVAS_W / 2
  const anchorY = centreWorld.y - mapH / 2

  // 3) Determine which tiles we need to cover the anchored viewport.
  const tileMinX = Math.floor(anchorX / TILE_SIZE)
  const tileMaxX = Math.floor((anchorX + CANVAS_W) / TILE_SIZE)
  const tileMinY = Math.floor(anchorY / TILE_SIZE)
  const tileMaxY = Math.floor((anchorY + mapH) / TILE_SIZE)

  // 4) Build the final canvas.
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')

  // Background (visible if tiles fail to load at edges).
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 5) Fetch tiles in parallel via fetch() → blob → createImageBitmap.
  //    This path is CORS-clean regardless of Safari's image-cache quirks,
  //    assuming the server sends Access-Control-Allow-Origin (OSM does).
  const tilePromises: Promise<void>[] = []
  for (let tx = tileMinX; tx <= tileMaxX; tx++) {
    for (let ty = tileMinY; ty <= tileMaxY; ty++) {
      tilePromises.push(drawTile(ctx, tx, ty, zoom, anchorX, anchorY))
    }
  }
  await Promise.all(tilePromises)

  // 6) Stroke the route with a white halo + orange line.
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  for (let i = 0; i < ride.track.length; i++) {
    const p = ride.track[i]
    const wp = lngLatToWorldPx(p.lng, p.lat, zoom)
    const x = wp.x - anchorX
    const y = wp.y - anchorY
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  // Halo
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 12
  ctx.stroke()
  // Main line
  ctx.strokeStyle = '#ff4d00'
  ctx.lineWidth = 7
  ctx.stroke()

  // Start + end dots
  drawDot(ctx, ride.track[0], zoom, anchorX, anchorY, '#22c55e')
  drawDot(
    ctx,
    ride.track[ride.track.length - 1],
    zoom,
    anchorX,
    anchorY,
    '#ef4444',
  )

  // 7) Gradient fade over the bottom of the map where the card sits.
  const gradH = 120
  const grad = ctx.createLinearGradient(0, mapH - gradH, 0, mapH)
  grad.addColorStop(0, 'rgba(10,10,10,0)')
  grad.addColorStop(1, 'rgba(10,10,10,1)')
  ctx.fillStyle = grad
  ctx.fillRect(0, mapH - gradH, CANVAS_W, gradH)

  // 8) Drop the card at the bottom.
  ctx.drawImage(cardCanvas, 0, CANVAS_H - cardH)

  // 9) OSM attribution footer (required by their tile usage policy).
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText('© OpenStreetMap contributors', CANVAS_W - 16, CANVAS_H - 12)

  // 10) Export.
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob returned null'))
    }, 'image/png')
  })
}

async function drawTile(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  z: number,
  anchorX: number,
  anchorY: number,
): Promise<void> {
  // Canonical OSM tile URL, no subdomain (HTTP/2 + unlimited-per-host).
  const url = `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`
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
    // Swallow — the canvas background will show through for this tile.
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
  ctx.arc(x, y, 10, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y, 7, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}
