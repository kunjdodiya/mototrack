import { db } from './db'
import type { Ride } from '../../types/ride'

export async function saveRide(ride: Ride): Promise<void> {
  await db.rides.put(ride)
}

export async function getRide(id: string): Promise<Ride | undefined> {
  return db.rides.get(id)
}

export async function deleteRide(id: string): Promise<void> {
  await db.rides.delete(id)
}

export async function markSynced(id: string, syncedAt: number): Promise<void> {
  await db.rides.update(id, { syncedAt })
}

/** All rides, newest first. */
export async function listRides(): Promise<Ride[]> {
  return db.rides.orderBy('startedAt').reverse().toArray()
}
