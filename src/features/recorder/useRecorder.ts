import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Ride, TrackPoint } from '../../types/ride'
import { watchPosition, type GeoError } from './geolocation'
import { requestWakeLock } from './wakeLock'
import { shouldAcceptPoint } from './smoothing'
import { haversine } from '../stats/haversine'
import { computeStats } from '../stats/computeStats'
import { saveRide } from '../storage/rides'
import { getDeviceId } from '../storage/deviceId'

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'saving'

type RecorderState = {
  status: RecorderStatus
  points: TrackPoint[]
  startedAt: number | null
  liveDistanceMeters: number
  liveDurationMs: number
  liveSpeedMps: number | null
  error: GeoError | null

  start: () => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => Promise<Ride | null>
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
  liveDistanceMeters: 0,
  liveDurationMs: 0,
  liveSpeedMps: null,
  error: null,

  start: async () => {
    if (get().status !== 'idle') return

    const startedAt = Date.now()
    set({
      status: 'recording',
      startedAt,
      points: [],
      liveDistanceMeters: 0,
      liveDurationMs: 0,
      liveSpeedMps: null,
      error: null,
    })

    releaseWakeLock = await requestWakeLock()

    stopWatch = watchPosition(
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
    const { status, points, startedAt } = get()
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
    }

    await saveRide(ride)

    // Leave the recorder in 'idle' with the final counts visible briefly;
    // consumers navigate away to /ride/:id.
    set({ status: 'idle' })
    return ride
  },

  reset: () => {
    tearDown()
    set({
      status: 'idle',
      points: [],
      startedAt: null,
      liveDistanceMeters: 0,
      liveDurationMs: 0,
      liveSpeedMps: null,
      error: null,
    })
  },
}))
