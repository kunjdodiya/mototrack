import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Ride, RideStats } from '../../types/ride'
import type { Bike } from '../../types/bike'
import type { Trip } from '../../types/trip'

const rideStore = new Map<string, Ride>()
const bikeStore = new Map<string, Bike>()
const tripStore = new Map<string, Trip>()

vi.mock('./db', () => ({
  db: {
    rides: {
      toArray: () => Promise.resolve(Array.from(rideStore.values())),
      bulkPut: (rides: Ride[]) => {
        for (const r of rides) rideStore.set(r.id, r)
        return Promise.resolve()
      },
      get: (id: string) => Promise.resolve(rideStore.get(id)),
      update: (id: string, patch: Partial<Ride>) => {
        const existing = rideStore.get(id)
        if (existing) rideStore.set(id, { ...existing, ...patch })
        return Promise.resolve()
      },
    },
    bikes: {
      toArray: () => Promise.resolve(Array.from(bikeStore.values())),
      bulkPut: (bikes: Bike[]) => {
        for (const b of bikes) bikeStore.set(b.id, b)
        return Promise.resolve()
      },
      update: (id: string, patch: Partial<Bike>) => {
        const existing = bikeStore.get(id)
        if (existing) bikeStore.set(id, { ...existing, ...patch })
        return Promise.resolve()
      },
    },
    trips: {
      toArray: () => Promise.resolve(Array.from(tripStore.values())),
      bulkPut: (trips: Trip[]) => {
        for (const t of trips) tripStore.set(t.id, t)
        return Promise.resolve()
      },
      update: (id: string, patch: Partial<Trip>) => {
        const existing = tripStore.get(id)
        if (existing) tripStore.set(id, { ...existing, ...patch })
        return Promise.resolve()
      },
    },
  },
}))

vi.mock('../auth/session', () => ({
  getUserId: () => Promise.resolve('user-1'),
}))

const rideUpsertSpy = vi.fn().mockResolvedValue({ error: null })
const bikeUpsertSpy = vi.fn().mockResolvedValue({ error: null })
const tripUpsertSpy = vi.fn().mockResolvedValue({ error: null })
const rideDeleteSpy = vi.fn()
const bikeDeleteSpy = vi.fn()
const tripDeleteSpy = vi.fn()
const rideDelete: { error: { message: string } | null } = { error: null }
const bikeDelete: { error: { message: string } | null } = { error: null }
const tripDelete: { error: { message: string } | null } = { error: null }
const rideSelect: {
  rows: unknown[]
  error: { message: string } | null
} = { rows: [], error: null }
const bikeSelect: {
  rows: unknown[]
  error: { message: string } | null
} = { rows: [], error: null }
const tripSelect: {
  rows: unknown[]
  error: { message: string } | null
} = { rows: [], error: null }

vi.mock('../auth/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      upsert: (...args: unknown[]) => {
        if (table === 'rides') return rideUpsertSpy(...args)
        if (table === 'bikes') return bikeUpsertSpy(...args)
        return tripUpsertSpy(...args)
      },
      select: () => ({
        order: () =>
          Promise.resolve(
            table === 'rides'
              ? { data: rideSelect.rows, error: rideSelect.error }
              : table === 'bikes'
                ? { data: bikeSelect.rows, error: bikeSelect.error }
                : { data: tripSelect.rows, error: tripSelect.error },
          ),
      }),
      delete: () => ({
        eq: (...args: unknown[]) => {
          if (table === 'rides') {
            rideDeleteSpy(...args)
            return Promise.resolve({ error: rideDelete.error })
          }
          if (table === 'bikes') {
            bikeDeleteSpy(...args)
            return Promise.resolve({ error: bikeDelete.error })
          }
          tripDeleteSpy(...args)
          return Promise.resolve({ error: tripDelete.error })
        },
      }),
    }),
  },
}))

import {
  pullRemoteRides,
  pullRemoteBikes,
  pullRemoteTrips,
  pullFromCloud,
  pushBike,
  pushDeleteBike,
  pushDeleteRide,
  pushDeleteTrip,
  syncWithCloud,
} from './sync'

const emptyStats: RideStats = {
  distanceMeters: 0,
  durationMs: 0,
  movingDurationMs: 0,
  idleDurationMs: 0,
  avgSpeedMps: null,
  maxSpeedMps: null,
  maxLeanAngleDeg: null,
  elevationGainMeters: null,
}

beforeEach(() => {
  rideStore.clear()
  bikeStore.clear()
  tripStore.clear()
  rideUpsertSpy.mockClear()
  bikeUpsertSpy.mockClear()
  tripUpsertSpy.mockClear()
  rideDeleteSpy.mockClear()
  bikeDeleteSpy.mockClear()
  tripDeleteSpy.mockClear()
  rideSelect.rows = []
  rideSelect.error = null
  bikeSelect.rows = []
  bikeSelect.error = null
  tripSelect.rows = []
  tripSelect.error = null
  rideDelete.error = null
  bikeDelete.error = null
  tripDelete.error = null
})

describe('pullRemoteRides', () => {
  it('upserts remote rides into Dexie with name/bike_id/trip_id mapped and syncedAt set', async () => {
    rideSelect.rows = [
      {
        id: 'ride-a',
        device_id: 'phone-A',
        started_at: new Date(1_700_000_000_000).toISOString(),
        ended_at: new Date(1_700_000_600_000).toISOString(),
        stats: { ...emptyStats, distanceMeters: 1200, durationMs: 600_000 },
        track: [],
        name: 'Monsoon loop',
        bike_id: 'bike-1',
        trip_id: 'trip-1',
      },
    ]

    await pullRemoteRides()

    const local = rideStore.get('ride-a')
    expect(local).toBeDefined()
    expect(local?.deviceId).toBe('phone-A')
    expect(local?.startedAt).toBe(1_700_000_000_000)
    expect(local?.name).toBe('Monsoon loop')
    expect(local?.bikeId).toBe('bike-1')
    expect(local?.tripId).toBe('trip-1')
    expect(local?.syncedAt).toBeTypeOf('number')
  })

  it('omits name/bikeId/tripId when the server row has nulls', async () => {
    rideSelect.rows = [
      {
        id: 'ride-b',
        device_id: 'phone-A',
        started_at: new Date(0).toISOString(),
        ended_at: new Date(1000).toISOString(),
        stats: emptyStats,
        track: [],
        name: null,
        bike_id: null,
        trip_id: null,
      },
    ]

    await pullRemoteRides()

    const local = rideStore.get('ride-b')
    expect(local?.name).toBeUndefined()
    expect(local?.bikeId).toBeUndefined()
    expect(local?.tripId).toBeUndefined()
  })

  it('overwrites an existing local copy with the server copy', async () => {
    rideStore.set('ride-c', {
      id: 'ride-c',
      deviceId: 'stale-device',
      startedAt: 0,
      endedAt: 0,
      stats: emptyStats,
      track: [],
      syncedAt: 1,
    })
    rideSelect.rows = [
      {
        id: 'ride-c',
        device_id: 'fresh-device',
        started_at: new Date(2_000_000_000_000).toISOString(),
        ended_at: new Date(2_000_000_100_000).toISOString(),
        stats: { ...emptyStats, distanceMeters: 42 },
        track: [{ lat: 1, lng: 2, ts: 3, speed: null, alt: null, acc: 5 }],
        name: null,
        bike_id: null,
        trip_id: null,
      },
    ]

    await pullRemoteRides()

    const local = rideStore.get('ride-c')
    expect(local?.deviceId).toBe('fresh-device')
    expect(local?.stats.distanceMeters).toBe(42)
    expect(local?.track).toHaveLength(1)
  })

  it('no-ops quietly when the server call fails', async () => {
    rideSelect.error = { message: 'network down' }
    await expect(pullRemoteRides()).resolves.toBeUndefined()
    expect(rideStore.size).toBe(0)
  })
})

describe('pullRemoteBikes', () => {
  it('upserts remote bikes into Dexie with syncedAt set', async () => {
    bikeSelect.rows = [
      {
        id: 'bike-1',
        name: 'CB350',
        created_at: new Date(1_700_000_000_000).toISOString(),
      },
    ]

    await pullRemoteBikes()

    const local = bikeStore.get('bike-1')
    expect(local?.name).toBe('CB350')
    expect(local?.createdAt).toBe(1_700_000_000_000)
    expect(local?.syncedAt).toBeTypeOf('number')
  })
})

describe('pullRemoteTrips', () => {
  it('upserts remote trips into Dexie with cover/notes/syncedAt mapped', async () => {
    tripSelect.rows = [
      {
        id: 'trip-1',
        name: 'Ladakh 2026',
        cover_color: 'aurora',
        notes: '6-day loop',
        created_at: new Date(1_700_000_000_000).toISOString(),
      },
    ]

    await pullRemoteTrips()

    const local = tripStore.get('trip-1')
    expect(local?.name).toBe('Ladakh 2026')
    expect(local?.coverColor).toBe('aurora')
    expect(local?.notes).toBe('6-day loop')
    expect(local?.createdAt).toBe(1_700_000_000_000)
    expect(local?.syncedAt).toBeTypeOf('number')
  })
})

describe('pullFromCloud', () => {
  it('pulls trips + rides + bikes without pushing local unsynced rows', async () => {
    rideStore.set('local-unsynced', {
      id: 'local-unsynced',
      deviceId: 'phone-B',
      startedAt: 10,
      endedAt: 20,
      stats: emptyStats,
      track: [],
      syncedAt: null,
    })
    rideSelect.rows = [
      {
        id: 'remote-ride',
        device_id: 'phone-A',
        started_at: new Date(1000).toISOString(),
        ended_at: new Date(2000).toISOString(),
        stats: emptyStats,
        track: [],
        name: null,
        bike_id: null,
        trip_id: null,
      },
    ]

    await pullFromCloud()

    expect(rideUpsertSpy).not.toHaveBeenCalled()
    expect(bikeUpsertSpy).not.toHaveBeenCalled()
    expect(tripUpsertSpy).not.toHaveBeenCalled()
    expect(rideStore.has('remote-ride')).toBe(true)
    expect(rideStore.get('local-unsynced')?.syncedAt).toBeNull()
  })
})

describe('syncWithCloud', () => {
  it('pushes local unsynced rows, then pulls remote trips/rides/bikes', async () => {
    rideStore.set('local-only-ride', {
      id: 'local-only-ride',
      deviceId: 'phone-B',
      startedAt: 10,
      endedAt: 20,
      stats: emptyStats,
      track: [],
      syncedAt: null,
    })
    bikeStore.set('local-only-bike', {
      id: 'local-only-bike',
      name: 'Himalayan',
      createdAt: 5,
      syncedAt: null,
    })
    tripStore.set('local-only-trip', {
      id: 'local-only-trip',
      name: 'Coastal run',
      coverColor: 'ocean',
      notes: null,
      createdAt: 4,
      syncedAt: null,
    })
    rideSelect.rows = [
      {
        id: 'remote-only-ride',
        device_id: 'phone-A',
        started_at: new Date(1000).toISOString(),
        ended_at: new Date(2000).toISOString(),
        stats: emptyStats,
        track: [],
        name: null,
        bike_id: null,
        trip_id: null,
      },
    ]
    bikeSelect.rows = [
      {
        id: 'remote-only-bike',
        name: 'Interceptor',
        created_at: new Date(0).toISOString(),
      },
    ]
    tripSelect.rows = [
      {
        id: 'remote-only-trip',
        name: 'Monsoon ride',
        cover_color: 'neon',
        notes: null,
        created_at: new Date(0).toISOString(),
      },
    ]

    await syncWithCloud()

    expect(rideUpsertSpy).toHaveBeenCalledTimes(1)
    expect(bikeUpsertSpy).toHaveBeenCalledTimes(1)
    expect(tripUpsertSpy).toHaveBeenCalledTimes(1)
    expect(rideStore.has('remote-only-ride')).toBe(true)
    expect(bikeStore.has('remote-only-bike')).toBe(true)
    expect(tripStore.has('remote-only-trip')).toBe(true)
  })
})

describe('pushDelete', () => {
  it('returns true when the supabase delete succeeds and pins by id', async () => {
    const ok = await pushDeleteRide('ride-x')
    expect(ok).toBe(true)
    expect(rideDeleteSpy).toHaveBeenCalledWith('id', 'ride-x')
  })

  it('returns false (and does not throw) when the supabase delete errors', async () => {
    rideDelete.error = { message: 'permission denied' }
    const ok = await pushDeleteRide('ride-x')
    expect(ok).toBe(false)
  })

  it('exposes the same shape for bikes and trips', async () => {
    expect(await pushDeleteBike('bike-x')).toBe(true)
    expect(bikeDeleteSpy).toHaveBeenCalledWith('id', 'bike-x')

    expect(await pushDeleteTrip('trip-x')).toBe(true)
    expect(tripDeleteSpy).toHaveBeenCalledWith('id', 'trip-x')
  })

  it('waits for an in-flight push of the same id before deleting', async () => {
    let resolveUpsert: (value: { error: null }) => void = () => {}
    const upsertGate = new Promise<{ error: null }>((resolve) => {
      resolveUpsert = resolve
    })
    bikeUpsertSpy.mockImplementationOnce(() => upsertGate)

    const order: string[] = []
    const pushP = pushBike({
      id: 'bike-race',
      name: 'CB350',
      createdAt: 1,
      syncedAt: null,
    }).then(() => order.push('push'))

    const deleteP = pushDeleteBike('bike-race').then(() => {
      order.push('delete')
    })

    await Promise.resolve()
    expect(bikeDeleteSpy).not.toHaveBeenCalled()

    resolveUpsert({ error: null })
    await Promise.all([pushP, deleteP])

    expect(order).toEqual(['push', 'delete'])
    expect(bikeDeleteSpy).toHaveBeenCalledWith('id', 'bike-race')
  })
})
