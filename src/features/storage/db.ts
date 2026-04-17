import Dexie, { type Table } from 'dexie'
import type { Ride } from '../../types/ride'

class MotoDB extends Dexie {
  rides!: Table<Ride, string>

  constructor() {
    super('mototrack')
    this.version(1).stores({
      // id primary key; indexed by startedAt for chronological queries and
      // syncedAt so we can find unsynced rides cheaply
      rides: 'id, startedAt, syncedAt',
    })
  }
}

export const db = new MotoDB()
