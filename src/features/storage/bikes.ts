import { v4 as uuidv4 } from 'uuid'
import { db } from './db'
import type { Bike } from '../../types/bike'

export async function listBikes(): Promise<Bike[]> {
  return db.bikes.orderBy('createdAt').toArray()
}

export async function getBike(id: string): Promise<Bike | undefined> {
  return db.bikes.get(id)
}

export async function addBike(name: string): Promise<Bike> {
  const bike: Bike = {
    id: uuidv4(),
    name: name.trim(),
    createdAt: Date.now(),
    syncedAt: null,
  }
  await db.bikes.put(bike)
  return bike
}

export async function renameBike(id: string, name: string): Promise<void> {
  await db.bikes.update(id, { name: name.trim(), syncedAt: null })
}

export async function deleteBike(id: string): Promise<void> {
  await db.bikes.delete(id)
}

export async function markBikeSynced(id: string, syncedAt: number): Promise<void> {
  await db.bikes.update(id, { syncedAt })
}
