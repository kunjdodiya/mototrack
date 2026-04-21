export type ClubAccent = 'sunrise' | 'neon' | 'ocean' | 'aurora' | 'ember'

export const CLUB_ACCENTS: ClubAccent[] = [
  'sunrise',
  'neon',
  'ocean',
  'aurora',
  'ember',
]

export type Club = {
  id: string
  name: string
  description: string | null
  city: string | null
  accent: ClubAccent
  createdBy: string
  memberCount: number
  createdAt: number
}

export type ClubMembership = {
  clubId: string
  userId: string
  joinedAt: number
}

export type ClubEvent = {
  id: string
  clubId: string
  title: string
  description: string | null
  startAt: number
  meetLabel: string | null
  meetLat: number | null
  meetLng: number | null
  createdBy: string
  goingCount: number
  createdAt: number
}

export type RsvpStatus = 'going' | 'maybe' | 'no'

export type EventRsvp = {
  eventId: string
  userId: string
  status: RsvpStatus
  updatedAt: number
}
