import Dexie, { type Table } from 'dexie'
import type { Ride, RideStats } from '../../types/ride'
import type { Bike } from '../../types/bike'
import type { Trip } from '../../types/trip'

class MotoDB extends Dexie {
  rides!: Table<Ride, string>
  bikes!: Table<Bike, string>
  trips!: Table<Trip, string>

  constructor() {
    super('mototrack')
    this.version(1).stores({
      rides: 'id, startedAt, syncedAt',
    })
    // v2 adds the bikes table and backfills new ride-stats fields
    // (idleDurationMs, maxLeanAngleDeg) for rides recorded before this version.
    this.version(2)
      .stores({
        rides: 'id, startedAt, syncedAt',
        bikes: 'id, createdAt, syncedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table<Ride>('rides')
          .toCollection()
          .modify((r) => {
            const s = r.stats as Partial<RideStats>
            if (s.idleDurationMs == null) {
              const dur = s.durationMs ?? 0
              const moving = s.movingDurationMs ?? 0
              r.stats.idleDurationMs = Math.max(0, dur - moving)
            }
            if (s.maxLeanAngleDeg === undefined) {
              r.stats.maxLeanAngleDeg = null
            }
          })
      })
    // v3 adds the trips table and a `tripId` index on rides so
    // `where('tripId').equals(id)` can list a trip's rides without a full scan.
    this.version(3).stores({
      rides: 'id, startedAt, syncedAt, tripId',
      bikes: 'id, createdAt, syncedAt',
      trips: 'id, createdAt, syncedAt',
    })
  }
}

export const db = new MotoDB()

/**
 * Drop every user-scoped row from local Dexie. Used by `AuthGate` when a
 * different Google account signs in on the same device — leaving the previous
 * user's rides/bikes/trips behind would let `useLiveQuery` (which doesn't
 * filter by user) leak them into the new user's history and profile totals
 * until the next pull races them out. Schema/version are untouched.
 */
export async function clearLocalUserData(): Promise<void> {
  await Promise.all([db.rides.clear(), db.bikes.clear(), db.trips.clear()])
}
