import type { Ride } from '../../types/ride'
import { supabase } from '../auth/supabase'
import { getUserId } from '../auth/session'
import { db } from './db'
import { markSynced } from './rides'

/**
 * Push a ride row to Supabase. Sets `syncedAt` on success. Swallows errors so
 * a failed cloud push never breaks the local-first flow — the next call to
 * syncUnsyncedRides() will retry.
 */
export async function pushRide(ride: Ride): Promise<boolean> {
  const userId = await getUserId()
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
 * Push every ride still marked as unsynced. Called after sign-in so rides
 * recorded on this device get claimed by the signed-in user.
 */
export async function syncUnsyncedRides(): Promise<void> {
  const all = await db.rides.toArray()
  const unsynced = all.filter((r) => r.syncedAt == null)
  for (const ride of unsynced) {
    await pushRide(ride)
  }
}
