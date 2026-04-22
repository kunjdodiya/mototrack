import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Ride, TrackPoint } from '../../types/ride'
import { platform, type GeoError } from '../platform'
import { shouldAcceptPoint } from './smoothing'
import { haversine } from '../stats/haversine'
import { computeStats } from '../stats/computeStats'
import { saveRide } from '../storage/rides'
import { pushRide } from '../storage/sync'
import { getDeviceId } from '../storage/deviceId'

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'saving'

export type StartOpts = {
  name?: string
  bikeId?: string
}

type RecorderState = {
  status: RecorderStatus
  points: TrackPoint[]
  startedAt: number | null
  name: string | null
  bikeId: string | null
  liveDistanceMeters: number
  liveDurationMs: number
  liveSpeedMps: number | null
  error: GeoError | null

  start: (opts?: StartOpts) => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => Promise<Ride | null>
  stopAt: (endedAt: number) => Promise<Ride | null>
  reset: () => void
}

// Side-effects kept out of the store object so rerenders don't touch them.
let stopWatch: (() => void) | null = null
let releaseWakeLock: (() => void) | null = null
let tickInterval: number | null = null

function tearDown() {
  stopWatch?.()
  stopWatch = null
  releaseWakeLock?.()
  releaseWakeLock = null
  if (tickInterval != null) {
    clearInterval(tickInterval)
    tickInterval = null
  }
}

export const useRecorder = create<RecorderState>((set, get) => ({
  status: 'idle',
  points: [],
  startedAt: null,
  name: null,
  bikeId: null,
  liveDistanceMeters: 0,
  liveDurationMs: 0,
  liveSpeedMps: null,
  error: null,

  start: async (opts?: StartOpts) => {
    if (get().status !== 'idle') return

    const startedAt = Date.now()
    set({
      status: 'recording',
      startedAt,
      points: [],
      name: opts?.name?.trim() || null,
      bikeId: opts?.bikeId || null,
      liveDistanceMeters: 0,
      liveDurationMs: 0,
      liveSpeedMps: null,
      error: null,
    })

    releaseWakeLock = await platform.requestWakeLock()

    stopWatch = platform.watchPosition(
      (point) => {
        const state = get()
        if (state.status !== 'recording') return // ignore while paused

        const prev = state.points[state.points.length - 1] ?? null
        const decision = shouldAcceptPoint(point, prev)
        if (!decision.accept) return

        const added = prev ? haversine(prev.lat, prev.lng, point.lat, point.lng) : 0

        set({
          points: [...state.points, point],
          liveDistanceMeters: state.liveDistanceMeters + added,
          liveSpeedMps: point.speed,
        })
      },
      (err) => set({ error: err }),
    )

    // Duration ticker — detached from GPS fixes so the display updates even
    // when the rider is stationary at a red light.
    tickInterval = window.setInterval(() => {
      const s = get()
      if (s.status === 'recording' && s.startedAt != null) {
        set({ liveDurationMs: Date.now() - s.startedAt })
      }
    }, 1000)
  },

  pause: () => {
    if (get().status !== 'recording') return
    set({ status: 'paused' })
  },

  resume: () => {
    if (get().status !== 'paused') return
    set({ status: 'recording' })
  },

  stop: async () => {
    const { status, points, startedAt, name, bikeId } = get()
    if (status === 'idle' || startedAt == null) return null

    set({ status: 'saving' })
    tearDown()

    const endedAt = Date.now()
    const stats = computeStats(points, startedAt, endedAt)
    const ride: Ride = {
      id: uuidv4(),
      deviceId: getDeviceId(),
      startedAt,
      endedAt,
      track: points,
      stats,
      syncedAt: null,
      ...(name ? { name } : {}),
      ...(bikeId ? { bikeId } : {}),
    }

    await saveRide(ride)

    // Fire-and-forget cloud sync; failure is OK (marked unsynced, retried
    // next boot by syncUnsyncedRides).
    void pushRide(ride)

    // Leave the recorder in 'idle' with the final counts visible briefly;
    // consumers navigate away to /ride/:id.
    set({ status: 'idle' })
    return ride
  },

  stopAt: async (endedAt: number) => {
    const { status, points, startedAt, name, bikeId } = get()
    if (status === 'idle' || startedAt == null) return null

    // Clamp: never before start, never after now.
    const now = Date.now()
    const clamped = Math.min(now, Math.max(startedAt, endedAt))

    set({ status: 'saving' })
    tearDown()

    const trimmed = points.filter((p) => p.ts <= clamped)
    const stats = computeStats(trimmed, startedAt, clamped)
    const ride: Ride = {
      id: uuidv4(),
      deviceId: getDeviceId(),
      startedAt,
      endedAt: clamped,
      track: trimmed,
      stats,
      syncedAt: null,
      ...(name ? { name } : {}),
      ...(bikeId ? { bikeId } : {}),
    }

    await saveRide(ride)
    void pushRide(ride)

    set({ status: 'idle' })
    return ride
  },

  reset: () => {
    tearDown()
    set({
      status: 'idle',
      points: [],
      startedAt: null,
      name: null,
      bikeId: null,
      liveDistanceMeters: 0,
      liveDurationMs: 0,
      liveSpeedMps: null,
      error: null,
    })
  },
}))
