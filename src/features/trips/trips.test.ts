import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Trip } from '../../types/trip'
import type { Ride } from '../../types/ride'

const tripStore = new Map<string, Trip>()
const rideStore = new Map<string, Ride>()

function ridesWhereTripId(tripId: string) {
  return {
    toArray: () =>
      Promise.resolve(
        Array.from(rideStore.values()).filter((r) => r.tripId === tripId),
      ),
    modify: (fn: (r: Ride) => void) => {
      for (const r of rideStore.values()) {
        if (r.tripId === tripId) {
          fn(r)
          rideStore.set(r.id, r)
        }
      }
      return Promise.resolve()
    },
  }
}

vi.mock('../storage/db', () => ({
  db: {
    trips: {
      orderBy: () => ({
        reverse: () => ({
          toArray: () =>
            Promise.resolve(
              Array.from(tripStore.values()).sort(
                (a, b) => b.createdAt - a.createdAt,
              ),
            ),
        }),
        toArray: () =>
          Promise.resolve(
            Array.from(tripStore.values()).sort(
              (a, b) => a.createdAt - b.createdAt,
            ),
          ),
      }),
      get: (id: string) => Promise.resolve(tripStore.get(id)),
      put: (t: Trip) => {
        tripStore.set(t.id, t)
        return Promise.resolve()
      },
      update: (id: string, patch: Partial<Trip>) => {
        const existing = tripStore.get(id)
        if (existing) tripStore.set(id, { ...existing, ...patch })
        return Promise.resolve()
      },
      delete: (id: string) => {
        tripStore.delete(id)
        return Promise.resolve()
      },
    },
    rides: {
      where: (key: string) => {
        if (key !== 'tripId') throw new Error(`unexpected where(${key})`)
        return {
          equals: (val: string) => ridesWhereTripId(val),
        }
      },
      get: (id: string) => Promise.resolve(rideStore.get(id)),
      put: (r: Ride) => {
        rideStore.set(r.id, r)
        return Promise.resolve()
      },
      update: (id: string, patch: Partial<Ride>) => {
        const existing = rideStore.get(id)
        if (existing) rideStore.set(id, { ...existing, ...patch })
        return Promise.resolve()
      },
    },
  },
}))

import {
  addRideToTrip,
  createTrip,
  deleteTrip,
  listRidesForTrip,
  listTrips,
  removeRideFromTrip,
  updateTrip,
} from './trips'

function ride(id: string, overrides: Partial<Ride> = {}): Ride {
  return {
    id,
    deviceId: 'd',
    startedAt: 0,
    endedAt: 0,
    track: [],
    stats: {
      distanceMeters: 0,
      durationMs: 0,
      movingDurationMs: 0,
      idleDurationMs: 0,
      avgSpeedMps: null,
      maxSpeedMps: null,
      maxLeanAngleDeg: null,
      elevationGainMeters: null,
    },
    syncedAt: 100,
    ...overrides,
  }
}

describe('trips CRUD', () => {
  beforeEach(() => {
    tripStore.clear()
    rideStore.clear()
  })

  it('creates a trip with trimmed name, default cover, and null notes', async () => {
    const t = await createTrip({ name: '  Ladakh 2026  ' })
    expect(t.name).toBe('Ladakh 2026')
    expect(t.coverColor).toBe('sunrise')
    expect(t.notes).toBeNull()
    expect(t.syncedAt).toBeNull()
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(tripStore.get(t.id)?.name).toBe('Ladakh 2026')
  })

  it('stores custom cover and trimmed notes', async () => {
    const t = await createTrip({
      name: 'Coastal run',
      coverColor: 'neon',
      notes: '  6-session loop  ',
    })
    expect(t.coverColor).toBe('neon')
    expect(t.notes).toBe('6-session loop')
  })

  it('lists trips newest first', async () => {
    await createTrip({ name: 'Old' })
    await new Promise((r) => setTimeout(r, 2))
    await createTrip({ name: 'New' })
    const out = await listTrips()
    expect(out.map((t) => t.name)).toEqual(['New', 'Old'])
  })

  it('updateTrip flips syncedAt back to null', async () => {
    const t = await createTrip({ name: 'Trip' })
    tripStore.set(t.id, { ...t, syncedAt: 999 })
    await updateTrip(t.id, { name: 'Renamed' })
    expect(tripStore.get(t.id)?.name).toBe('Renamed')
    expect(tripStore.get(t.id)?.syncedAt).toBeNull()
  })

  it('addRideToTrip attaches and marks ride unsynced', async () => {
    rideStore.set('r1', ride('r1'))
    const t = await createTrip({ name: 'T' })
    await addRideToTrip('r1', t.id)
    expect(rideStore.get('r1')?.tripId).toBe(t.id)
    expect(rideStore.get('r1')?.syncedAt).toBeNull()
  })

  it('removeRideFromTrip detaches and marks ride unsynced', async () => {
    const t = await createTrip({ name: 'T' })
    rideStore.set('r1', ride('r1', { tripId: t.id, syncedAt: 42 }))
    await removeRideFromTrip('r1')
    expect(rideStore.get('r1')?.tripId).toBeUndefined()
    expect(rideStore.get('r1')?.syncedAt).toBeNull()
  })

  it('listRidesForTrip returns only rides with that tripId, oldest first', async () => {
    const t = await createTrip({ name: 'T' })
    rideStore.set('r1', ride('r1', { tripId: t.id, startedAt: 3 }))
    rideStore.set('r2', ride('r2', { tripId: t.id, startedAt: 1 }))
    rideStore.set('r3', ride('r3', { tripId: 'other', startedAt: 2 }))
    rideStore.set('r4', ride('r4', { tripId: t.id, startedAt: 2 }))
    const out = await listRidesForTrip(t.id)
    expect(out.map((r) => r.id)).toEqual(['r2', 'r4', 'r1'])
  })

  it('deleteTrip detaches every attached ride and removes the trip', async () => {
    const t = await createTrip({ name: 'T' })
    rideStore.set('r1', ride('r1', { tripId: t.id, syncedAt: 1 }))
    rideStore.set('r2', ride('r2', { tripId: t.id, syncedAt: 2 }))
    rideStore.set('r3', ride('r3', { tripId: 'other', syncedAt: 3 }))
    await deleteTrip(t.id)
    expect(tripStore.has(t.id)).toBe(false)
    expect(rideStore.get('r1')?.tripId).toBeUndefined()
    expect(rideStore.get('r1')?.syncedAt).toBeNull()
    expect(rideStore.get('r2')?.tripId).toBeUndefined()
    expect(rideStore.get('r3')?.tripId).toBe('other')
    expect(rideStore.get('r3')?.syncedAt).toBe(3)
  })
})
