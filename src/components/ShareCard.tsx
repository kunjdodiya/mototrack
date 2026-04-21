import { useEffect, useState } from 'react'
import type { Ride } from '../types/ride'
import {
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
}

/**
 * Inline stats card shown on the ride summary screen. The shareable
 * Instagram-Story PNG is composed separately in
 * features/share/exportPng.ts (pure canvas, not rasterized DOM).
 */
export default function ShareCard({ ride }: Props) {
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

  return (
    <div className="w-full rounded-3xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex items-baseline justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Stats
          </div>
          {ride.bikeId && bikeName && (
            <div
              className="mt-2 inline-block rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-semibold text-neutral-200"
              data-testid="bike-chip"
            >
              🏍 {bikeName}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <SpeedGraph track={ride.track} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Distance" value={formatDistance(stats.distanceMeters)} />
        <Stat label="Duration" value={formatDuration(stats.durationMs)} />
        <Stat label="Moving time" value={formatDuration(stats.movingDurationMs)} />
        <Stat label="Idle time" value={formatDuration(stats.idleDurationMs)} />
        <Stat label="Avg speed" value={formatSpeed(stats.avgSpeedMps)} />
        <Stat label="Top speed" value={formatSpeed(stats.maxSpeedMps)} />
        <Stat label="Max lean" value={formatLeanAngle(stats.maxLeanAngleDeg)} />
        <Stat label="Elev gain" value={formatElevation(stats.elevationGainMeters)} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tracking-tight tabular-nums">
        {value}
      </div>
    </div>
  )
}
