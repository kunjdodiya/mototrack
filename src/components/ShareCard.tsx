import { useEffect, useState } from 'react'
import type { Ride } from '../types/ride'
import {
  formatDateTime,
  formatDistance,
  formatDuration,
  formatElevation,
  formatLeanAngle,
  formatSpeed,
} from '../features/stats/format'
import { getBike } from '../features/storage/bikes'
import SpeedGraph from './SpeedGraph'

type Props = {
  ride: Ride
  /** true = big poster layout (1080 wide); false = inline card in the UI */
  poster?: boolean
}

/**
 * The stats card. Rendered inline on the summary screen, and rendered
 * off-screen at poster size during PNG export (features/share/exportPng.ts).
 */
export default function ShareCard({ ride, poster = false }: Props) {
  const { stats } = ride
  const [bikeName, setBikeName] = useState<string | null>(null)

  useEffect(() => {
    if (!ride.bikeId) return
    const bikeId = ride.bikeId
    let cancelled = false
    void getBike(bikeId).then((b) => {
      if (!cancelled) setBikeName(b?.name ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [ride.bikeId])

  const root = poster
    ? 'w-[1080px] p-12 text-white'
    : 'w-full rounded-xl border border-neutral-800 bg-neutral-900/60 p-5'

  const labelSize = poster ? 'text-base' : 'text-[10px]'
  const valueSize = poster ? 'text-5xl' : 'text-xl'

  const title = ride.name ?? formatDateTime(ride.startedAt)
  const subtitle = ride.name
    ? formatDateTime(ride.startedAt)
    : null

  return (
    <div
      className={root}
      style={{ background: poster ? '#0a0a0a' : undefined, fontFamily: "'Inter', -apple-system, sans-serif" }}
    >
      <div className="flex items-baseline justify-between">
        <div className="min-w-0 flex-1">
          <div
            className={`font-extrabold tracking-tight ${poster ? 'text-3xl' : 'text-sm'}`}
          >
            <span style={{ color: '#ff4d00' }}>Moto</span>Track
          </div>
          <div
            className={`mt-1 truncate font-bold tracking-tight ${poster ? 'text-5xl' : 'text-xl'}`}
          >
            {title}
          </div>
          {subtitle && (
            <div
              className={`mt-1 ${poster ? 'text-xl text-neutral-400' : 'text-xs text-neutral-500'}`}
            >
              {subtitle}
            </div>
          )}
          {ride.bikeId && bikeName && (
            <div
              className={`mt-2 inline-block rounded-full border border-neutral-700 ${poster ? 'px-4 py-1 text-lg' : 'px-2.5 py-0.5 text-xs'} font-semibold text-neutral-200`}
              data-testid="bike-chip"
            >
              🏍 {bikeName}
            </div>
          )}
        </div>
      </div>

      <div className={poster ? 'mt-8' : 'mt-4'}>
        <SpeedGraph track={ride.track} poster={poster} />
      </div>

      <div className={poster ? 'mt-8 grid grid-cols-3 gap-6' : 'mt-4 grid grid-cols-3 gap-2'}>
        <Stat
          label="Distance"
          value={formatDistance(stats.distanceMeters)}
          labelSize={labelSize}
          valueSize={valueSize}
          poster={poster}
        />
        <Stat
          label="Duration"
          value={formatDuration(stats.durationMs)}
          labelSize={labelSize}
          valueSize={valueSize}
          poster={poster}
        />
        <Stat
          label="Moving time"
          value={formatDuration(stats.movingDurationMs)}
          labelSize={labelSize}
          valueSize={valueSize}
          poster={poster}
        />
        <Stat
          label="Idle time"
          value={formatDuration(stats.idleDurationMs)}
          labelSize={labelSize}
          valueSize={valueSize}
          poster={poster}
        />
        <Stat
          label="Avg speed"
          value={formatSpeed(stats.avgSpeedMps)}
          labelSize={labelSize}
          valueSize={valueSize}
          poster={poster}
        />
        <Stat
          label="Top speed"
          value={formatSpeed(stats.maxSpeedMps)}
          labelSize={labelSize}
          valueSize={valueSize}
          poster={poster}
        />
        <Stat
          label="Max lean"
          value={formatLeanAngle(stats.maxLeanAngleDeg)}
          labelSize={labelSize}
          valueSize={valueSize}
          poster={poster}
        />
        <Stat
          label="Elev gain"
          value={formatElevation(stats.elevationGainMeters)}
          labelSize={labelSize}
          valueSize={valueSize}
          poster={poster}
        />
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  labelSize,
  valueSize,
  poster,
}: {
  label: string
  value: string
  labelSize: string
  valueSize: string
  poster: boolean
}) {
  return (
    <div
      className={
        poster
          ? ''
          : 'rounded-lg border border-neutral-800 bg-neutral-950/60 p-3'
      }
    >
      <div
        className={`font-semibold uppercase tracking-widest text-neutral-500 ${labelSize}`}
      >
        {label}
      </div>
      <div className={`mt-1 font-bold tracking-tight tabular-nums ${valueSize}`}>
        {value}
      </div>
    </div>
  )
}
