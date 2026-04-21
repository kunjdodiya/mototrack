import { useRecorder } from '../features/recorder/useRecorder'
import {
  formatDistance,
  formatDuration,
  formatSpeed,
} from '../features/stats/format'

export default function LiveStats() {
  const distance = useRecorder((s) => s.liveDistanceMeters)
  const duration = useRecorder((s) => s.liveDurationMs)
  const speed = useRecorder((s) => s.liveSpeedMps)

  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat label="Distance" value={formatDistance(distance)} />
      <Stat label="Time" value={formatDuration(duration)} />
      <Stat label="Speed" value={formatSpeed(speed)} highlight />
    </div>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={[
        'rounded-2xl border p-3 text-center transition',
        highlight
          ? 'border-moto-orange/30 bg-gradient-to-br from-moto-orange/15 to-moto-magenta/10'
          : 'border-white/5 bg-white/[0.03]',
      ].join(' ')}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </div>
      <div
        className={[
          'mt-1 font-display text-xl font-bold tabular-nums tracking-tight',
          highlight ? 'text-gradient' : 'text-white',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  )
}
