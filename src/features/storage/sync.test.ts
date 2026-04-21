import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Ride, RideStats } from '../../types/ride'
import type { Bike } from '../../types/bike'

const rideStore = new Map<string, Ride>()
const bikeStore = new Map<string, Bike>()

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
  },
}))

vi.mock('../auth/session', () => ({
  getUserId: () => Promise.resolve('user-1'),
}))

const rideUpsertSpy = vi.fn().mockResolvedValue({ error: null })
const bikeUpsertSpy = vi.fn().mockResolvedValue({ error: null })
const rideSelect: {
  rows: unknown[]
  error: { message: string } | null
} = { rows: [], error: null }
const bikeSelect: {
  rows: unknown[]
  error: { message: string } | null
} = { rows: [], error: null }

vi.mock('../auth/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      upsert: (...args: unknown[]) =>
        (table === 'rides' ? rideUpsertSpy : bikeUpsertSpy)(...args),
      select: () => ({
        order: () =>
          Promise.resolve(
            table === 'rides'
              ? { data: rideSelect.rows, error: rideSelect.error }
              : { data: bikeSelect.rows, error: bikeSelect.error },
          ),
      }),
    }),
  },
}))

import {
  pullRemoteRides,
  pullRemoteBikes,
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
  rideUpsertSpy.mockClear()
  bikeUpsertSpy.mockClear()
  rideSelect.rows = []
  rideSelect.error = null
  bikeSelect.rows = []
  bikeSelect.error = null
})

describe('pullRemoteRides', () => {
  it('upserts remote rides into Dexie with name/bike_id mapped and syncedAt set', async () => {
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
      },
    ]

    await pullRemoteRides()

    const local = rideStore.get('ride-a')
    expect(local).toBeDefined()
    expect(local?.deviceId).toBe('phone-A')
    expect(local?.startedAt).toBe(1_700_000_000_000)
    expect(local?.name).toBe('Monsoon loop')
    expect(local?.bikeId).toBe('bike-1')
    expect(local?.syncedAt).toBeTypeOf('number')
  })

  it('omits name/bikeId when the server row has nulls', async () => {
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
      },
    ]

    await pullRemoteRides()

    const local = rideStore.get('ride-b')
    expect(local?.name).toBeUndefined()
    expect(local?.bikeId).toBeUndefined()
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

describe('syncWithCloud', () => {
  it('pushes local unsynced rows, then pulls remote rides + bikes', async () => {
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
      },
    ]
    bikeSelect.rows = [
      {
        id: 'remote-only-bike',
        name: 'Interceptor',
        created_at: new Date(0).toISOString(),
      },
    ]

    await syncWithCloud()

    expect(rideUpsertSpy).toHaveBeenCalledTimes(1)
    expect(bikeUpsertSpy).toHaveBeenCalledTimes(1)
    expect(rideStore.has('remote-only-ride')).toBe(true)
    expect(bikeStore.has('remote-only-bike')).toBe(true)
  })
})
