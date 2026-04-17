import { v4 as uuidv4 } from 'uuid'
import type { Ride, TrackPoint } from '../../types/ride'
import { computeStats } from '../stats/computeStats'
import { saveRide } from './rides'
import { getDeviceId } from './deviceId'

/**
 * DEV ONLY. Produces a plausible-looking 20km loop ride in Mumbai so we can
 * verify map rendering, stats, and PNG export without going outside.
 */
export async function seedDemoRide(): Promise<Ride> {
  const startedAt = Date.now() - 75 * 60 * 1000 // 75 minutes ago
  const centre = { lat: 19.076, lng: 72.8777 }
  const pointCount = 450
  const track: TrackPoint[] = []
  let ts = startedAt

  for (let i = 0; i < pointCount; i++) {
    const t = i / pointCount
    // Bean-shaped loop around the centre.
    const angle = t * Math.PI * 2
    const radiusLat = 0.035 + Math.sin(angle * 3) * 0.008
    const radiusLng = 0.042 + Math.cos(angle * 2) * 0.01
    const lat = centre.lat + Math.cos(angle) * radiusLat
    const lng = centre.lng + Math.sin(angle) * radiusLng
    // Realistic motorcycle speed 40-70 km/h, slows near turns.
    const speed = 13 + Math.sin(angle * 4) * 6 // m/s
    ts += 10_000 // 10s between points
    track.push({
      lat,
      lng,
      ts,
      speed,
      alt: 10 + Math.sin(angle * 2) * 25,
      acc: 8,
    })
  }

  const endedAt = ts
  const ride: Ride = {
    id: uuidv4(),
    deviceId: getDeviceId(),
    startedAt,
    endedAt,
    track,
    stats: computeStats(track, startedAt, endedAt),
    syncedAt: null,
    name: 'Demo ride — Mumbai loop',
  }

  await saveRide(ride)
  return ride
}
