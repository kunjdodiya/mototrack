import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRecorder } from '../features/recorder/useRecorder'
import {
  playStartChime,
  playPauseChime,
  playResumeChime,
  playStopChime,
} from '../features/recorder/sound'
import { platform } from '../features/platform'
import { db } from '../features/storage/db'
import { addBike } from '../features/storage/bikes'
import { pushBike } from '../features/storage/sync'
import { readDefaultBikeId } from '../features/storage/preferences'
import type { TrackPoint } from '../types/ride'
import LiveStats from './LiveStats'
import RideMap from './RideMap'
import LocationBlockedCard from './LocationBlockedCard'
import ForgotToStopSheet from './ForgotToStopSheet'
import SwipeToStartButton from './SwipeToStartButton'

const isNative = Capacitor.isNativePlatform()

export default function RecordScreen() {
  const navigate = useNavigate()
  const status = useRecorder((s) => s.status)
  const error = useRecorder((s) => s.error)
  const points = useRecorder((s) => s.points)
  const startedAt = useRecorder((s) => s.startedAt)
  const liveDistanceMeters = useRecorder((s) => s.liveDistanceMeters)
  const liveDurationMs = useRecorder((s) => s.liveDurationMs)
  const pointCount = points.length
  const start = useRecorder((s) => s.start)
  const pause = useRecorder((s) => s.pause)
  const resume = useRecorder((s) => s.resume)
  const stop = useRecorder((s) => s.stop)
  const stopAt = useRecorder((s) => s.stopAt)
  const reset = useRecorder((s) => s.reset)

  const [showTrimSheet, setShowTrimSheet] = useState(false)

  const bikes = useLiveQuery(() => db.bikes.orderBy('createdAt').toArray(), [], [])
  const rideCount = useLiveQuery(() => db.rides.count(), [], 0)
  const firstTime = rideCount === 0

  const [rideName, setRideName] = useState('')
  const [selectedBikeId, setSelectedBikeId] = useState<string>(
    () => readDefaultBikeId() ?? '',
  )
  const [newBike, setNewBike] = useState('')
  const [addingBike, setAddingBike] = useState(false)
  const [showAddBike, setShowAddBike] = useState(false)

  // Hide the picked id if it doesn't match a locally-known bike — covers the
  // case where the default bike was deleted on another device and pulled away
  // before this screen rendered. The orphaned id isn't shown to the user.
  const displayedBikeId =
    selectedBikeId && bikes.some((b) => b.id === selectedBikeId)
      ? selectedBikeId
      : ''

  const handleAddBike = async () => {
    const name = newBike.trim()
    if (!name) return
    setAddingBike(true)
    try {
      const bike = await addBike(name)
      setNewBike('')
      setSelectedBikeId(bike.id)
      setShowAddBike(false)
      void pushBike(bike)
    } finally {
      setAddingBike(false)
    }
  }

  const idle = status === 'idle'
  const recording = status === 'recording'
  const paused = status === 'paused'
  const saving = status === 'saving'

  const [previewPoint, setPreviewPoint] = useState<TrackPoint | null>(null)
  const previewStopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!idle) return
    let cancelled = false
    void (async () => {
      const perm = await platform.checkLocationPermission()
      if (cancelled || perm !== 'granted') return
      const stopWatch = platform.watchPosition(
        (p) => {
          if (!cancelled) setPreviewPoint(p)
        },
        () => {},
      )
      if (cancelled) {
        stopWatch()
        return
      }
      previewStopRef.current = stopWatch
    })()
    return () => {
      cancelled = true
      previewStopRef.current?.()
      previewStopRef.current = null
      setPreviewPoint(null)
    }
  }, [idle])

  const handleStart = () => {
    playStartChime()
    platform.hapticTap('heavy')
    void start({
      name: rideName.trim() || undefined,
      bikeId: displayedBikeId || undefined,
    })
  }

  const handlePause = () => {
    playPauseChime()
    platform.hapticTap('light')
    pause()
  }

  const handleResume = () => {
    playResumeChime()
    platform.hapticTap('light')
    resume()
  }

  const handleStop = async () => {
    playStopChime()
    platform.hapticTap('medium')
    const ride = await stop()
    if (ride) {
      setRideName('')
      setSelectedBikeId(readDefaultBikeId() ?? '')
      navigate(`/ride/${ride.id}`)
    }
  }

  const handleTrimStop = async (endedAt: number) => {
    playStopChime()
    platform.hapticTap('medium')
    const ride = await stopAt(endedAt)
    setShowTrimSheet(false)
    if (ride) {
      setRideName('')
      setSelectedBikeId(readDefaultBikeId() ?? '')
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
    <div
      className={[
        'mx-auto flex max-w-xl flex-col gap-6 px-5 pb-6 pt-8',
        idle ? 'h-full' : '',
      ].join(' ')}
    >
      {idle ? (
        <>
          <header className="flex shrink-0 flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Ride Now
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight">
              Ready to <span className="text-gradient">roll</span>?
            </h1>
            <p className="text-sm text-neutral-400">
              {isNative
                ? 'Tap Start and ride — tracking runs in the background.'
                : 'Tap Start, keep the screen on, and ride.'}
            </p>
          </header>

          {firstTime && (
            <section
              aria-label="What you'll get"
              className="shrink-0 rounded-2xl border border-white/5 bg-white/[0.03] p-5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-moto-orange">
                First ride?
              </p>
              <p className="mt-2 text-sm text-neutral-300">
                Tap Start and ride — MotoTrack records your route, speed and
                distance live. When you stop, you'll get a detailed summary
                and a shareable story card ready for Instagram, WhatsApp and
                any other social app.
              </p>
              <ul className="mt-4 flex flex-col gap-2 text-sm text-neutral-300">
                <li className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gradient"
                  />
                  <span>Live speed, distance and route as you ride.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gradient"
                  />
                  <span>
                    A full summary when you stop — top speed, average speed,
                    duration and your exact map.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gradient"
                  />
                  <span>
                    One-tap share to Instagram, WhatsApp and other social apps.
                  </span>
                </li>
              </ul>
            </section>
          )}

          <div className="flex shrink-0 flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Ride name
              </span>
              <input
                type="text"
                value={rideName}
                onChange={(e) => setRideName(e.target.value)}
                placeholder="E.g. Sunday morning twisties"
                maxLength={60}
                className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white placeholder:text-neutral-600 transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Bike
              </span>
              {bikes.length === 0 || showAddBike ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBike}
                    onChange={(e) => setNewBike(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void handleAddBike()
                      } else if (e.key === 'Escape' && bikes.length > 0) {
                        e.preventDefault()
                        setNewBike('')
                        setShowAddBike(false)
                      }
                    }}
                    placeholder="E.g. KTM 390 Duke"
                    maxLength={40}
                    autoFocus={showAddBike}
                    className="flex-1 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white placeholder:text-neutral-600 transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddBike()}
                    disabled={addingBike || !newBike.trim()}
                    className="rounded-2xl bg-brand-gradient px-5 py-3.5 font-display font-semibold tracking-tight text-white shadow-glow-orange transition active:scale-[0.98] disabled:opacity-40"
                  >
                    Add
                  </button>
                  {bikes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewBike('')
                        setShowAddBike(false)
                      }}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm font-semibold text-neutral-300 transition active:scale-[0.98] hover:bg-white/[0.06]"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ) : (
                <select
                  value={displayedBikeId}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '__new__') {
                      setShowAddBike(true)
                      return
                    }
                    setSelectedBikeId(v)
                  }}
                  className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
                >
                  <option value="">Select</option>
                  {bikes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                  <option value="__new__">+ Add a new bike…</option>
                </select>
              )}
            </label>
          </div>

          <div className="animate-fade-up animate-gradient-shift min-h-[120px] flex-1 rounded-2xl bg-brand-gradient bg-[length:200%_200%] p-[2px] shadow-glow-orange">
            <div className="h-full overflow-hidden rounded-[14px] bg-neutral-950">
              <RideMap
                points={previewPoint ? [previewPoint] : []}
                follow={!!previewPoint}
                className="h-full bg-neutral-950"
              />
            </div>
          </div>

          <div className="animate-scale-in shrink-0 pt-2">
            <SwipeToStartButton onConfirm={handleStart} />
          </div>

          {error && (
            <p className="shrink-0 text-center text-sm text-red-400">
              GPS error: {error.message}
            </p>
          )}
        </>
      ) : (
        <div className="relative flex animate-launch flex-col gap-6">
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-16 animate-launch-burst rounded-full bg-brand-gradient blur-3xl"
          />

          {!isNative && (
            <div className="animate-fade-up rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              Keep screen on and app open. Auto-lock is disabled. Install the
              native app for true background tracking.
            </div>
          )}

          <div className="animate-fade-up">
            <LiveStats />
          </div>

          <div
            className={[
              'animate-fade-up rounded-2xl bg-brand-gradient bg-[length:200%_200%] p-[2px]',
              paused ? 'opacity-60' : 'animate-gradient-shift shadow-glow-orange',
            ].join(' ')}
          >
            <div className="h-64 overflow-hidden rounded-[14px] bg-neutral-950">
              <RideMap
                points={points}
                follow
                className="h-full bg-neutral-950"
              />
            </div>
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
                onClick={handlePause}
                className="rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-base font-semibold text-white transition active:scale-[0.98] hover:bg-white/[0.08]"
              >
                Pause
              </button>
            )}
            {paused && (
              <button
                type="button"
                onClick={handleResume}
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

          <button
            type="button"
            onClick={() => setShowTrimSheet(true)}
            disabled={saving || startedAt == null}
            className="mx-auto text-xs font-semibold text-neutral-400 underline decoration-dotted underline-offset-4 transition hover:text-white disabled:opacity-40"
          >
            Forgot to stop? Trim ride →
          </button>

          {error && (
            <p className="text-center text-sm text-red-400">
              GPS error: {error.message}
            </p>
          )}

          {showTrimSheet && startedAt != null && (
            <ForgotToStopSheet
              startedAt={startedAt}
              points={points}
              liveDistanceMeters={liveDistanceMeters}
              liveDurationMs={liveDurationMs}
              onConfirm={handleTrimStop}
              onClose={() => setShowTrimSheet(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}
