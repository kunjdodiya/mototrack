import { db } from './db'
import type { Ride } from '../../types/ride'
import { computeStats } from '../stats/computeStats'

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

/**
 * Rename a saved ride from the recap. Trims whitespace; an empty result
 * clears the name so the recap falls back to the formatted start date.
 * Clears `syncedAt` so the next sync pass re-pushes the renamed row.
 * Returns the updated ride, or null if the id isn't found.
 */
export async function renameRide(
  id: string,
  newName: string,
): Promise<Ride | null> {
  const existing = await db.rides.get(id)
  if (!existing) return null

  const trimmed = newName.trim()
  const updated: Ride = { ...existing, syncedAt: null }
  if (trimmed) {
    updated.name = trimmed
  } else {
    delete updated.name
  }
  await db.rides.put(updated)
  return updated
}

/**
 * Retroactively end a saved ride at `newEndedAt`: truncates the track where
 * `ts > newEndedAt`, recomputes stats against the new end, and clears
 * `syncedAt` so the next sync pass re-pushes the trimmed ride upstream. The
 * cutoff is clamped to `[startedAt, original endedAt]` so a silly input can
 * never produce a negative-duration ride or extend the ride past its
 * original end. Returns the updated ride, or null if the id isn't found.
 */
export async function trimRide(
  id: string,
  newEndedAt: number,
): Promise<Ride | null> {
  const existing = await db.rides.get(id)
  if (!existing) return null

  const clamped = Math.min(existing.endedAt, Math.max(existing.startedAt, newEndedAt))
  const track = existing.track.filter((p) => p.ts <= clamped)
  const stats = computeStats(track, existing.startedAt, clamped)

  const updated: Ride = {
    ...existing,
    endedAt: clamped,
    track,
    stats,
    syncedAt: null,
  }
  await db.rides.put(updated)
  return updated
}
