import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../auth/supabase'
import { getUserId } from '../auth/session'
import type { ClubEvent, RsvpStatus } from '../../types/club'

type RemoteEventRow = {
  id: string
  club_id: string
  title: string
  description: string | null
  start_at: string
  meet_label: string | null
  meet_lat: number | null
  meet_lng: number | null
  created_by: string
  going_count: number
  created_at: string
}

const EVENT_COLUMNS =
  'id, club_id, title, description, start_at, meet_label, meet_lat, meet_lng, created_by, going_count, created_at'

function rowToEvent(r: RemoteEventRow): ClubEvent {
  return {
    id: r.id,
    clubId: r.club_id,
    title: r.title,
    description: r.description,
    startAt: new Date(r.start_at).getTime(),
    meetLabel: r.meet_label,
    meetLat: r.meet_lat,
    meetLng: r.meet_lng,
    createdBy: r.created_by,
    goingCount: r.going_count,
    createdAt: new Date(r.created_at).getTime(),
  }
}

export async function listUpcomingEventsForClub(
  clubId: string,
): Promise<ClubEvent[]> {
  const { data, error } = await supabase
    .from('club_events')
    .select(EVENT_COLUMNS)
    .eq('club_id', clubId)
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as RemoteEventRow[]).map(rowToEvent)
}

export async function listUpcomingEventsForMyClubs(
  limit = 10,
): Promise<ClubEvent[]> {
  const userId = await getUserId()
  if (!userId) return []
  const { data: memberRows, error: memberError } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', userId)
  if (memberError) throw memberError
  const ids = (memberRows ?? []).map((r: { club_id: string }) => r.club_id)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('club_events')
    .select(EVENT_COLUMNS)
    .in('club_id', ids)
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as RemoteEventRow[]).map(rowToEvent)
}

export async function getEvent(id: string): Promise<ClubEvent | null> {
  const { data, error } = await supabase
    .from('club_events')
    .select(EVENT_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return rowToEvent(data as RemoteEventRow)
}

export async function createEvent(input: {
  clubId: string
  title: string
  description?: string | null
  startAt: number
  meetLabel?: string | null
  meetLat?: number | null
  meetLng?: number | null
}): Promise<ClubEvent> {
  const userId = await getUserId()
  if (!userId) throw new Error('Sign in required.')
  const id = uuidv4()
  const row = {
    id,
    club_id: input.clubId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    start_at: new Date(input.startAt).toISOString(),
    meet_label: input.meetLabel?.trim() || null,
    meet_lat: input.meetLat ?? null,
    meet_lng: input.meetLng ?? null,
    created_by: userId,
  }
  const { data, error } = await supabase
    .from('club_events')
    .insert(row)
    .select(EVENT_COLUMNS)
    .single()
  if (error) throw error
  return rowToEvent(data as RemoteEventRow)
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('club_events').delete().eq('id', id)
  if (error) throw error
}

export async function getMyRsvp(eventId: string): Promise<RsvpStatus | null> {
  const userId = await getUserId()
  if (!userId) return null
  const { data, error } = await supabase
    .from('event_rsvps')
    .select('status')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data?.status as RsvpStatus | undefined) ?? null
}

export async function setMyRsvp(
  eventId: string,
  status: RsvpStatus,
): Promise<void> {
  const userId = await getUserId()
  if (!userId) throw new Error('Sign in required.')
  const { error } = await supabase
    .from('event_rsvps')
    .upsert(
      { event_id: eventId, user_id: userId, status, updated_at: new Date().toISOString() },
      { onConflict: 'event_id,user_id' },
    )
  if (error) throw error
}

export async function clearMyRsvp(eventId: string): Promise<void> {
  const userId = await getUserId()
  if (!userId) throw new Error('Sign in required.')
  const { error } = await supabase
    .from('event_rsvps')
    .delete()
    .match({ event_id: eventId, user_id: userId })
  if (error) throw error
}
