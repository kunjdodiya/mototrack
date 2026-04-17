import type { Ride } from '../../types/ride'
import { supabase, cloudSyncEnabled } from '../auth/supabase'
import { ensureAnonymousSession } from '../auth/anon'
import { db } from './db'
import { markSynced } from './rides'

/**
 * Push a ride row to Supabase. Sets `syncedAt` on success. Swallows errors so
 * a failed cloud push never breaks the local-first flow — the next call to
 * syncUnsyncedRides() will retry.
 */
export async function pushRide(ride: Ride): Promise<boolean> {
  if (!cloudSyncEnabled || !supabase) return false

  const userId = await ensureAnonymousSession()
  if (!userId) return false

  const { error } = await supabase.from('rides').upsert(
    {
      id: ride.id,
      user_id: userId,
      device_id: ride.deviceId,
      started_at: new Date(ride.startedAt).toISOString(),
      ended_at: new Date(ride.endedAt).toISOString(),
      stats: ride.stats,
      track: ride.track,
    },
    { onConflict: 'id' },
  )
  if (error) {
    console.warn('Ride push failed:', error.message)
    return false
  }
  await markSynced(ride.id, Date.now())
  return true
}

/**
 * Push every ride still marked as unsynced. Called on app boot so rides
 * recorded while offline get uploaded when connectivity returns.
 */
export async function syncUnsyncedRides(): Promise<void> {
  if (!cloudSyncEnabled) return
  const pending = await db.rides.where('syncedAt').equals(-1).toArray().catch(
    // Dexie will throw on a null-index query; fall back to a full scan.
    async () => (await db.rides.toArray()).filter((r) => r.syncedAt == null),
  )
  const unsynced =
    pending.length > 0 ? pending : (await db.rides.toArray()).filter((r) => r.syncedAt == null)

  for (const ride of unsynced) {
    // Serialize — avoid slamming the API.
    await pushRide(ride)
  }
}
