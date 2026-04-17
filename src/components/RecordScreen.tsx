import { useNavigate } from 'react-router-dom'
import { useRecorder } from '../features/recorder/useRecorder'
import LiveStats from './LiveStats'
import RideMap from './RideMap'

export default function RecordScreen() {
  const navigate = useNavigate()
  const status = useRecorder((s) => s.status)
  const error = useRecorder((s) => s.error)
  const points = useRecorder((s) => s.points)
  const pointCount = points.length
  const start = useRecorder((s) => s.start)
  const pause = useRecorder((s) => s.pause)
  const resume = useRecorder((s) => s.resume)
  const stop = useRecorder((s) => s.stop)

  const idle = status === 'idle'
  const recording = status === 'recording'
  const paused = status === 'paused'
  const saving = status === 'saving'

  const handleStop = async () => {
    const ride = await stop()
    if (ride) navigate(`/ride/${ride.id}`)
  }

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col gap-6 p-6">
      {idle ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Ready to ride?
            </h1>
            <p className="mt-2 text-neutral-400">
              Tap Start, keep the screen on, and ride. We'll track your route.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void start()}
            className="h-40 w-40 rounded-full bg-moto-orange text-xl font-semibold text-white shadow-lg shadow-moto-orange/30 transition active:scale-95"
          >
            Start
          </button>
          {error && (
            <p className="text-sm text-red-400">GPS error: {error.message}</p>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-amber-950/60 border border-amber-900 px-3 py-2 text-xs text-amber-200">
            Keep screen on and app open. Auto-lock is disabled. True background
            tracking needs the native app (coming soon).
          </div>

          <LiveStats />

          <div className="h-64">
            <RideMap points={points} follow className="h-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950" />
          </div>

          <div className="text-center text-xs text-neutral-500">
            {pointCount} GPS fixes · {paused ? 'paused' : 'recording'}
          </div>

          <div className="mt-auto grid grid-cols-2 gap-3">
            {recording && (
              <button
                type="button"
                onClick={pause}
                className="rounded-xl bg-neutral-800 py-4 text-base font-semibold text-white transition active:scale-[0.98]"
              >
                Pause
              </button>
            )}
            {paused && (
              <button
                type="button"
                onClick={resume}
                className="rounded-xl bg-moto-orange py-4 text-base font-semibold text-white transition active:scale-[0.98]"
              >
                Resume
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleStop()}
              disabled={saving}
              className="rounded-xl bg-red-600 py-4 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Stop'}
            </button>
          </div>

          {error && (
            <p className="text-center text-sm text-red-400">
              GPS error: {error.message}
            </p>
          )}
        </>
      )}
    </div>
  )
}
