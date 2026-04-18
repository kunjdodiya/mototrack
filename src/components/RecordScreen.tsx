import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRecorder } from '../features/recorder/useRecorder'
import { db } from '../features/storage/db'
import LiveStats from './LiveStats'
import RideMap from './RideMap'
import LocationBlockedCard from './LocationBlockedCard'

const isNative = Capacitor.isNativePlatform()

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
  const reset = useRecorder((s) => s.reset)

  const bikes = useLiveQuery(() => db.bikes.orderBy('createdAt').toArray(), [], [])

  const [rideName, setRideName] = useState('')
  const [selectedBikeId, setSelectedBikeId] = useState<string>('')

  const idle = status === 'idle'
  const recording = status === 'recording'
  const paused = status === 'paused'
  const saving = status === 'saving'

  const handleStart = () => {
    void start({
      name: rideName.trim() || undefined,
      bikeId: selectedBikeId || undefined,
    })
  }

  const handleStop = async () => {
    const ride = await stop()
    if (ride) {
      setRideName('')
      setSelectedBikeId('')
      navigate(`/ride/${ride.id}`)
    }
  }

  const handleRetry = () => {
    reset()
    handleStart()
  }

  if (error?.kind === 'permission-denied') {
    return (
      <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center p-6">
        <LocationBlockedCard onRetry={handleRetry} />
      </div>
    )
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
              {isNative
                ? "Tap Start and ride. We'll track your route in the background."
                : "Tap Start, keep the screen on, and ride. We'll track your route."}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 text-left">
            <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Ride name
              <input
                type="text"
                value={rideName}
                onChange={(e) => setRideName(e.target.value)}
                placeholder="Sunday morning twisties"
                maxLength={60}
                className="mt-1 block w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-base font-medium text-white placeholder:text-neutral-600 focus:border-moto-orange focus:outline-none"
              />
            </label>

            <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Bike
              {bikes.length === 0 ? (
                <div className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-dashed border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-400">
                  <span>No bikes yet.</span>
                  <Link
                    to="/profile"
                    className="font-semibold text-moto-orange hover:underline"
                  >
                    Add one →
                  </Link>
                </div>
              ) : (
                <select
                  value={selectedBikeId}
                  onChange={(e) => setSelectedBikeId(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-base font-medium text-white focus:border-moto-orange focus:outline-none"
                >
                  <option value="">— none —</option>
                  {bikes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>

          <button
            type="button"
            onClick={handleStart}
            className="h-40 w-40 rounded-full bg-moto-orange text-xl font-semibold tracking-tight text-white shadow-lg shadow-moto-orange/30 transition active:scale-95"
          >
            Start
          </button>
          {error && (
            <p className="text-sm text-red-400">GPS error: {error.message}</p>
          )}
        </div>
      ) : (
        <>
          {!isNative && (
            <div className="rounded-xl bg-amber-950/60 border border-amber-900 px-3 py-2 text-xs text-amber-200">
              Keep screen on and app open. Auto-lock is disabled. For true
              background tracking, install the native app.
            </div>
          )}

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
