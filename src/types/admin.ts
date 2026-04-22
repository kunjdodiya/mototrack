export type AdminUserCounts = {
  total: number
  newToday: number
  newLast7: number
  newLast30: number
}

export type AdminActiveUsers = {
  dau: number
  wau: number
  mau: number
}

export type AdminRideCounts = {
  total: number
  totalDistanceMeters: number
  totalDurationMs: number
  totalMovingMs: number
  riddenToday: number
  riddenLast7: number
  riddenLast30: number
}

export type AdminContentCounts = {
  bikeCount: number
  tripCount: number
  clubCount: number
  eventCount: number
  rsvpCount: number
}

export type AdminSignupBucket = {
  date: string
  count: number
}

export type AdminTopRider = {
  userId: string
  email: string | null
  name: string | null
  rideCount: number
  totalDistanceMeters: number
  totalDurationMs: number
}

export type AdminRecentUser = {
  userId: string
  email: string | null
  name: string | null
  createdAt: number
  lastSignInAt: number | null
  rideCount: number
}

export type AdminDashboard = {
  generatedAt: number
  users: AdminUserCounts
  activeUsers: AdminActiveUsers
  rides: AdminRideCounts
  content: AdminContentCounts
  signupsLast30: AdminSignupBucket[]
  topRiders: AdminTopRider[]
  recentUsers: AdminRecentUser[]
}
