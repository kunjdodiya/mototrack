export type Trip = {
  id: string
  name: string
  coverColor: TripCover
  notes: string | null
  createdAt: number
  syncedAt: number | null
}

export type TripCover =
  | 'sunrise'
  | 'neon'
  | 'ocean'
  | 'aurora'
  | 'ember'

export const TRIP_COVERS: readonly TripCover[] = [
  'sunrise',
  'neon',
  'ocean',
  'aurora',
  'ember',
] as const
