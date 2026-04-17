/**
 * Web Mercator projection math matching Leaflet/OSM's standard 256-px tiles.
 * We reimplement this (instead of using Leaflet's) so the PNG export can run
 * without the Leaflet runtime — it's a pure canvas operation.
 */

const TILE_SIZE = 256

/** lat/lng → absolute world pixel at zoom z (floating point). */
export function lngLatToWorldPx(
  lng: number,
  lat: number,
  z: number,
): { x: number; y: number } {
  const scale = TILE_SIZE * Math.pow(2, z)
  const x = ((lng + 180) / 360) * scale
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const y =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  return { x, y }
}

export type LatLng = { lat: number; lng: number }

/**
 * Pick the largest zoom at which the route's bounding box fits inside the
 * given (widthPx, heightPx) viewport with a pixel padding margin.
 */
export function fitZoomForBounds(
  points: LatLng[],
  widthPx: number,
  heightPx: number,
  paddingPx = 80,
  maxZoom = 18,
  minZoom = 2,
): number {
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const latMin = Math.min(...lats)
  const latMax = Math.max(...lats)
  const lngMin = Math.min(...lngs)
  const lngMax = Math.max(...lngs)

  for (let z = maxZoom; z >= minZoom; z--) {
    const ne = lngLatToWorldPx(lngMax, latMax, z)
    const sw = lngLatToWorldPx(lngMin, latMin, z)
    const w = Math.abs(ne.x - sw.x)
    const h = Math.abs(ne.y - sw.y)
    if (w + 2 * paddingPx <= widthPx && h + 2 * paddingPx <= heightPx) {
      return z
    }
  }
  return minZoom
}

/** Centre (lat/lng) of a list of points. */
export function centreOf(points: LatLng[]): LatLng {
  const latMin = Math.min(...points.map((p) => p.lat))
  const latMax = Math.max(...points.map((p) => p.lat))
  const lngMin = Math.min(...points.map((p) => p.lng))
  const lngMax = Math.max(...points.map((p) => p.lng))
  return { lat: (latMin + latMax) / 2, lng: (lngMin + lngMax) / 2 }
}

export { TILE_SIZE }
