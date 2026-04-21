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
      <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center p-6">
        <LocationBlockedCard onRetry={handleRetry} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-6 pt-8">
      {idle ? (
        <>
          <header className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Ride Now
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight">
              Ready to <span className="text-gradient">roll</span>?
            </h1>
            <p className="text-sm text-neutral-400">
              {isNative
                ? "Tap Start and ride — tracking runs in the background."
                : 'Tap Start, keep the screen on, and ride.'}
            </p>
          </header>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Ride name
              </span>
              <input
                type="text"
                value={rideName}
                onChange={(e) => setRideName(e.target.value)}
                placeholder="Sunday morning twisties"
                maxLength={60}
                className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white placeholder:text-neutral-600 transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Bike
              </span>
              {bikes.length === 0 ? (
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3.5 text-sm text-neutral-400">
                  <span>No bikes yet.</span>
                  <Link
                    to="/profile"
                    className="font-semibold text-gradient hover:opacity-80"
                  >
                    Add one →
                  </Link>
                </div>
              ) : (
                <select
                  value={selectedBikeId}
                  onChange={(e) => setSelectedBikeId(e.target.value)}
                  className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
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

          <div className="flex animate-scale-in flex-col items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleStart}
              aria-label="Start ride"
              className="group relative flex h-44 w-44 items-center justify-center rounded-full bg-brand-gradient text-xl font-display font-bold tracking-tight text-white shadow-glow-orange transition-transform duration-200 active:scale-95"
            >
              <span
                aria-hidden
                className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-gradient"
              />
              <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
              <span className="relative">Start</span>
            </button>
            <p className="text-xs text-neutral-500">Hold the line. Go.</p>
          </div>

          {error && (
            <p className="text-center text-sm text-red-400">
              GPS error: {error.message}
            </p>
          )}
        </>
      ) : (
        <>
          {!isNative && (
            <div className="animate-fade-up rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              Keep screen on and app open. Auto-lock is disabled. Install the
              native app for true background tracking.
            </div>
          )}

          <div className="animate-fade-up">
            <LiveStats />
          </div>

          <div className="h-64 animate-fade-up overflow-hidden rounded-2xl border border-white/5 shadow-lg">
            <RideMap
              points={points}
              follow
              className="h-full bg-neutral-950"
            />
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
            <span
              aria-hidden
              className={[
                'h-2 w-2 rounded-full',
                paused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse',
              ].join(' ')}
            />
            <span>
              {pointCount} GPS fixes · {paused ? 'paused' : 'recording'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {recording && (
              <button
                type="button"
                onClick={pause}
                className="rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-base font-semibold text-white transition active:scale-[0.98] hover:bg-white/[0.08]"
              >
                Pause
              </button>
            )}
            {paused && (
              <button
                type="button"
                onClick={resume}
                className="rounded-2xl bg-brand-gradient py-4 text-base font-semibold text-white shadow-glow-orange transition active:scale-[0.98]"
              >
                Resume
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleStop()}
              disabled={saving}
              className="rounded-2xl bg-red-600 py-4 text-base font-semibold text-white shadow-[0_10px_40px_-10px_rgba(220,38,38,0.6)] transition active:scale-[0.98] disabled:opacity-60"
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
