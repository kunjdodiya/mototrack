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
import type { Ride, TrackPoint } from '../types/ride'

type Props = {
  rides: Ride[]
  className?: string
}

const DEFAULT_CENTRE: [number, number] = [20.7619, 73.377]
const DEFAULT_ZOOM = 6

// Per-session palette. Picked so consecutive sessions stay visually distinct
// on the CARTO Dark Matter base; wraps around for trips with more than 8
// sessions.
const SESSION_COLORS = [
  '#ff4d00',
  '#ff2d87',
  '#7c3aed',
  '#22d3ee',
  '#34d399',
  '#facc15',
  '#fb7185',
  '#60a5fa',
]

export default function TripMap({ rides, className }: Props) {
  const lines = useMemo(
    () =>
      rides
        .map((r, i) => ({
          id: r.id,
          color: SESSION_COLORS[i % SESSION_COLORS.length],
          positions: r.track.map((p) => [p.lat, p.lng] as [number, number]),
          start: r.track[0] ?? null,
          end: r.track[r.track.length - 1] ?? null,
        }))
        .filter((l) => l.positions.length > 1),
    [rides],
  )

  const allPoints = useMemo(
    () => lines.flatMap((l) => l.positions),
    [lines],
  )

  return (
    <div
      className={
        className ??
        'overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950'
      }
    >
      <MapContainer
        center={DEFAULT_CENTRE}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
        style={{ minHeight: 240 }}
      >
        <TileLayer
          url="https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          crossOrigin="anonymous"
          maxZoom={19}
        />
        {lines.map((l) => (
          <Polyline
            key={l.id}
            positions={l.positions}
            pathOptions={{ color: l.color, weight: 5, opacity: 0.95 }}
          />
        ))}
        {lines.map(
          (l) =>
            l.start && (
              <CircleMarker
                key={`s-${l.id}`}
                center={[l.start.lat, l.start.lng] as [number, number]}
                radius={6}
                pathOptions={{
                  stroke: false,
                  fillColor: l.color,
                  fillOpacity: 1,
                }}
              />
            ),
        )}
        {lines.length > 0 &&
          (() => {
            const last = lines[lines.length - 1]
            const endPoint: TrackPoint | null = last.end
            return (
              endPoint && (
                <CircleMarker
                  center={[endPoint.lat, endPoint.lng] as [number, number]}
                  radius={8}
                  pathOptions={{
                    stroke: false,
                    fillColor: '#ef4444',
                    fillOpacity: 1,
                  }}
                />
              )
            )
          })()}
        <TripMapController points={allPoints} />
      </MapContainer>
    </div>
  )
}

function TripMapController({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length < 2) return
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [points, map])
  return null
}
