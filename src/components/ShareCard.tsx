import type { Ride } from '../types/ride'
import {
  formatDateTime,
  formatDistance,
  formatDuration,
  formatElevation,
  formatSpeed,
} from '../features/stats/format'

type Props = {
  ride: Ride
  /** true = big poster layout (1080 wide); false = inline card in the UI */
  poster?: boolean
}

/**
 * The stats card. Rendered inline on the summary screen, and rendered
 * off-screen at poster size during PNG export (features/share/exportPng.ts).
 * Uses only system fonts so html-to-image doesn't need cross-origin font
 * loads.
 */
export default function ShareCard({ ride, poster = false }: Props) {
  const { stats } = ride

  const root = poster
    ? 'w-[1080px] p-12 text-white'
    : 'w-full rounded-xl border border-neutral-800 bg-neutral-900/60 p-5'

  const titleSize = poster ? 'text-4xl' : 'text-lg'
  const labelSize = poster ? 'text-lg' : 'text-xs'
  const valueSize = poster ? 'text-6xl' : 'text-2xl'

  return (
    <div className={root} style={{ background: poster ? '#0a0a0a' : undefined }}>
      <div className="flex items-baseline justify-between">
        <div>
          <div className={`font-semibold tracking-tight ${titleSize}`}>
            <span style={{ color: '#ff4d00' }}>Moto</span>Track
          </div>
          <div
            className={
              poster
                ? 'mt-2 text-lg text-neutral-400'
                : 'text-xs text-neutral-500'
            }
          >
            {formatDateTime(ride.startedAt)}
          </div>
        </div>
      </div>

      <div className={poster ? 'mt-10 grid grid-cols-2 gap-8' : 'mt-4 grid grid-cols-2 gap-3'}>
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
          label="Max speed"
          value={formatSpeed(stats.maxSpeedMps)}
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
      <div className={`uppercase tracking-wide text-neutral-500 ${labelSize}`}>
        {label}
      </div>
      <div className={`mt-1 font-semibold tabular-nums ${valueSize}`}>{value}</div>
    </div>
  )
}
