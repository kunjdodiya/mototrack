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
      <Stat label="Speed" value={formatSpeed(speed)} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-center">
      <div className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}
