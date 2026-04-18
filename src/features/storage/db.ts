import Dexie, { type Table } from 'dexie'
import type { Ride, RideStats } from '../../types/ride'
import type { Bike } from '../../types/bike'

class MotoDB extends Dexie {
  rides!: Table<Ride, string>
  bikes!: Table<Bike, string>

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
  }
}

export const db = new MotoDB()
