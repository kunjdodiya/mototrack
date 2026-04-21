import type { Ride, TrackPoint, RideStats } from '../../types/ride'
import type { Bike } from '../../types/bike'
import { supabase } from '../auth/supabase'
import { getUserId } from '../auth/session'
import { db } from './db'
import { markSynced } from './rides'
import { markBikeSynced } from './bikes'

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
      name: ride.name ?? null,
      bike_id: ride.bikeId ?? null,
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

export async function pushBike(bike: Bike): Promise<boolean> {
  const userId = await getUserId()
  if (!userId) return false

  const { error } = await supabase.from('bikes').upsert(
    {
      id: bike.id,
      user_id: userId,
      name: bike.name,
      created_at: new Date(bike.createdAt).toISOString(),
    },
    { onConflict: 'id' },
  )
  if (error) {
    console.warn('Bike push failed:', error.message)
    return false
  }
  await markBikeSynced(bike.id, Date.now())
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

  const allBikes = await db.bikes.toArray()
  const unsyncedBikes = allBikes.filter((b) => b.syncedAt == null)
  for (const bike of unsyncedBikes) {
    await pushBike(bike)
  }
}

type RemoteRideRow = {
  id: string
  device_id: string
  started_at: string
  ended_at: string
  stats: RideStats
  track: TrackPoint[]
  name: string | null
  bike_id: string | null
}

type RemoteBikeRow = {
  id: string
  name: string
  created_at: string
}

/**
 * Pull every ride the signed-in user owns on the server into local Dexie.
 * RLS scopes the select to `auth.uid()`, so this only ever returns rides
 * owned by the current user. Upsert by id — server copies are authoritative
 * once synced, and rides are immutable after Stop, so there is nothing to
 * merge. Marks each pulled ride `syncedAt = now` so the next push pass skips
 * it.
 */
export async function pullRemoteRides(): Promise<void> {
  const userId = await getUserId()
  if (!userId) return

  const { data, error } = await supabase
    .from('rides')
    .select(
      'id, device_id, started_at, ended_at, stats, track, name, bike_id',
    )
    .order('started_at', { ascending: false })
  if (error) {
    console.warn('Ride pull failed:', error.message)
    return
  }

  const rows = (data ?? []) as RemoteRideRow[]
  const now = Date.now()
  const rides: Ride[] = rows.map((r) => ({
    id: r.id,
    deviceId: r.device_id,
    startedAt: new Date(r.started_at).getTime(),
    endedAt: new Date(r.ended_at).getTime(),
    stats: r.stats,
    track: r.track,
    syncedAt: now,
    ...(r.name ? { name: r.name } : {}),
    ...(r.bike_id ? { bikeId: r.bike_id } : {}),
  }))
  if (rides.length > 0) await db.rides.bulkPut(rides)
}

/**
 * Pull every bike the signed-in user owns on the server into local Dexie.
 * Same rules as rides — RLS filters the select, upsert by id, mark synced.
 */
export async function pullRemoteBikes(): Promise<void> {
  const userId = await getUserId()
  if (!userId) return

  const { data, error } = await supabase
    .from('bikes')
    .select('id, name, created_at')
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('Bike pull failed:', error.message)
    return
  }

  const rows = (data ?? []) as RemoteBikeRow[]
  const now = Date.now()
  const bikes: Bike[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: new Date(r.created_at).getTime(),
    syncedAt: now,
  }))
  if (bikes.length > 0) await db.bikes.bulkPut(bikes)
}

/**
 * Two-way reconciliation after sign-in: push any local rides/bikes not yet
 * on the server, then pull everything the server has so rides, bikes, and
 * profile totals appear on every device signed into the same Google account.
 */
export async function syncWithCloud(): Promise<void> {
  await syncUnsyncedRides()
  await pullRemoteRides()
  await pullRemoteBikes()
}
