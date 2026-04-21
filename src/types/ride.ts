export type TrackPoint = {
  lat: number
  lng: number
  ts: number
  speed: number | null
  alt: number | null
  acc: number
}

export type RideStats = {
  distanceMeters: number
  durationMs: number
  movingDurationMs: number
  idleDurationMs: number
  avgSpeedMps: number | null
  maxSpeedMps: number | null
  maxLeanAngleDeg: number | null
  elevationGainMeters: number | null
}

export type Ride = {
  id: string
  deviceId: string
  startedAt: number
  endedAt: number
  track: TrackPoint[]
  stats: RideStats
  syncedAt: number | null
  name?: string
  bikeId?: string
  tripId?: string
}
