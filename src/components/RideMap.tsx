import { useEffect, useMemo } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import '../features/map/leafletIcons'
import type { TrackPoint } from '../types/ride'

type Props = {
  points: TrackPoint[]
  /** Keep the latest point centred while recording. */
  follow?: boolean
  /** Fit the whole route in view (used on the ride summary). */
  fitAll?: boolean
  className?: string
}

const DEFAULT_CENTRE: [number, number] = [19.076, 72.8777] // Mumbai fallback
const DEFAULT_ZOOM = 15

export default function RideMap({
  points,
  follow = false,
  fitAll = false,
  className,
}: Props) {
  const latLngs = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points],
  )
  const last = points[points.length - 1]

  return (
    <div
      className={
        className ??
        'overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950'
      }
    >
      <MapContainer
        center={last ? [last.lat, last.lng] : DEFAULT_CENTRE}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
        style={{ minHeight: 240 }}
      >
        <TileLayer
          // Canonical single host, no {s} subdomain (HTTP/2 makes sharding
          // unnecessary and OSM has deprecated the a/b/c hostnames).
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          crossOrigin="anonymous"
          maxZoom={19}
        />
        {latLngs.length > 1 && (
          <Polyline
            positions={latLngs}
            pathOptions={{ color: '#ff4d00', weight: 5, opacity: 0.95 }}
          />
        )}
        {last && (
          <CircleMarker
            center={[last.lat, last.lng]}
            radius={7}
            pathOptions={{
              color: '#fff',
              weight: 2,
              fillColor: '#ff4d00',
              fillOpacity: 1,
            }}
          />
        )}
        <MapController
          follow={follow}
          fitAll={fitAll}
          points={latLngs}
          last={last ? [last.lat, last.lng] : null}
        />
      </MapContainer>
    </div>
  )
}

function MapController({
  follow,
  fitAll,
  points,
  last,
}: {
  follow: boolean
  fitAll: boolean
  points: [number, number][]
  last: [number, number] | null
}) {
  const map = useMap()

  // Pan to latest fix while recording.
  useEffect(() => {
    if (follow && last) {
      map.panTo(last, { animate: true })
    }
  }, [follow, last, map])

  // One-shot fit-bounds for the post-ride summary.
  useEffect(() => {
    if (fitAll && points.length > 1) {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [fitAll, points, map])

  return null
}
