import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../auth/supabase'
import { getUserId } from '../auth/session'
import type { Club, ClubAccent } from '../../types/club'

type RemoteClubRow = {
  id: string
  name: string
  description: string | null
  city: string | null
  accent: ClubAccent
  created_by: string
  member_count: number
  created_at: string
}

function rowToClub(r: RemoteClubRow): Club {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    city: r.city,
    accent: r.accent,
    createdBy: r.created_by,
    memberCount: r.member_count,
    createdAt: new Date(r.created_at).getTime(),
  }
}

const CLUB_COLUMNS =
  'id, name, description, city, accent, created_by, member_count, created_at'

export async function listClubs(options?: {
  cityLike?: string | null
}): Promise<Club[]> {
  let q = supabase
    .from('clubs')
    .select(CLUB_COLUMNS)
    .order('member_count', { ascending: false })
    .order('created_at', { ascending: false })
  const needle = options?.cityLike?.trim()
  if (needle) q = q.ilike('city', `%${needle}%`)
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as RemoteClubRow[]).map(rowToClub)
}

export async function listMyClubs(): Promise<Club[]> {
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
    .from('clubs')
    .select(CLUB_COLUMNS)
    .in('id', ids)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as RemoteClubRow[]).map(rowToClub)
}

export async function getClub(id: string): Promise<Club | null> {
  const { data, error } = await supabase
    .from('clubs')
    .select(CLUB_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return rowToClub(data as RemoteClubRow)
}

export async function createClub(input: {
  name: string
  description?: string | null
  city?: string | null
  accent?: ClubAccent
}): Promise<Club> {
  const userId = await getUserId()
  if (!userId) throw new Error('Sign in required.')
  const id = uuidv4()
  const row = {
    id,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    city: input.city?.trim() || null,
    accent: input.accent ?? 'sunrise',
    created_by: userId,
  }
  const { data, error } = await supabase
    .from('clubs')
    .insert(row)
    .select(CLUB_COLUMNS)
    .single()
  if (error) throw error
  return rowToClub(data as RemoteClubRow)
}

export async function joinClub(clubId: string): Promise<void> {
  const userId = await getUserId()
  if (!userId) throw new Error('Sign in required.')
  const { error } = await supabase
    .from('club_members')
    .upsert({ club_id: clubId, user_id: userId }, { onConflict: 'club_id,user_id' })
  if (error) throw error
}

export async function leaveClub(clubId: string): Promise<void> {
  const userId = await getUserId()
  if (!userId) throw new Error('Sign in required.')
  const { error } = await supabase
    .from('club_members')
    .delete()
    .match({ club_id: clubId, user_id: userId })
  if (error) throw error
}

export async function isMember(clubId: string): Promise<boolean> {
  const userId = await getUserId()
  if (!userId) return false
  const { data, error } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}
