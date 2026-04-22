import { v4 as uuidv4 } from 'uuid'
import { db } from '../storage/db'
import type { Trip, TripCover } from '../../types/trip'
import type { Ride } from '../../types/ride'

export async function listTrips(): Promise<Trip[]> {
  return db.trips.orderBy('createdAt').reverse().toArray()
}

export async function getTrip(id: string): Promise<Trip | undefined> {
  return db.trips.get(id)
}

export async function createTrip(input: {
  name: string
  coverColor?: TripCover
  notes?: string | null
}): Promise<Trip> {
  const trip: Trip = {
    id: uuidv4(),
    name: input.name.trim(),
    coverColor: input.coverColor ?? 'sunrise',
    notes: input.notes?.trim() || null,
    createdAt: Date.now(),
    syncedAt: null,
  }
  await db.trips.put(trip)
  return trip
}

export async function updateTrip(
  id: string,
  patch: { name?: string; coverColor?: TripCover; notes?: string | null },
): Promise<void> {
  const next: Partial<Trip> = { syncedAt: null }
  if (patch.name !== undefined) next.name = patch.name.trim()
  if (patch.coverColor !== undefined) next.coverColor = patch.coverColor
  if (patch.notes !== undefined) next.notes = patch.notes?.trim() || null
  await db.trips.update(id, next)
}

export async function deleteTrip(id: string): Promise<void> {
  // Detach rides first so the trip deletion never leaves dangling tripId refs.
  await db.rides.where('tripId').equals(id).modify((r) => {
    delete r.tripId
    r.syncedAt = null
  })
  await db.trips.delete(id)
}

export async function markTripSynced(id: string, syncedAt: number): Promise<void> {
  await db.trips.update(id, { syncedAt })
}

/** Rides attached to a trip, ordered oldest first so Session 1/Session 2 reads top-down. */
export async function listRidesForTrip(tripId: string): Promise<Ride[]> {
  const rides = await db.rides.where('tripId').equals(tripId).toArray()
  return rides.sort((a, b) => a.startedAt - b.startedAt)
}

export async function addRideToTrip(rideId: string, tripId: string): Promise<void> {
  await db.rides.update(rideId, { tripId, syncedAt: null })
}

export async function removeRideFromTrip(rideId: string): Promise<void> {
  const ride = await db.rides.get(rideId)
  if (!ride) return
  delete ride.tripId
  ride.syncedAt = null
  await db.rides.put(ride)
}
