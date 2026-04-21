import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../auth/supabase'

const AVATAR_BUCKET = 'avatars'
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export type ProfileInfo = {
  name: string | null
  email: string | null
  avatarUrl: string | null
}

type GoogleLikeMetadata = {
  full_name?: string
  name?: string
  avatar_url?: string
  picture?: string
  custom_avatar_url?: string
}

export function getProfileInfo(session: Session | null): ProfileInfo {
  const user = session?.user ?? null
  if (!user) return { name: null, email: null, avatarUrl: null }

  const meta = (user.user_metadata ?? {}) as GoogleLikeMetadata
  const name = meta.full_name ?? meta.name ?? null
  const avatarUrl =
    meta.custom_avatar_url ?? meta.avatar_url ?? meta.picture ?? null

  return {
    name,
    email: user.email ?? null,
    avatarUrl,
  }
}

export async function uploadAvatar(file: File): Promise<string> {
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Profile photo must be 5 MB or smaller.')
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Profile photo must be an image.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const user = sessionData.session?.user
  if (!user) throw new Error('You must be signed in to change your photo.')

  const ext = guessImageExtension(file)
  const path = `${user.id}/avatar-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true })
  if (uploadError) throw uploadError

  const { data: publicUrlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(path)
  const publicUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`

  await saveCustomAvatarUrl(user, publicUrl)
  return publicUrl
}

export async function resetAvatar(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const user = sessionData.session?.user
  if (!user) return

  const meta = (user.user_metadata ?? {}) as GoogleLikeMetadata
  if (!meta.custom_avatar_url) return

  const { error } = await supabase.auth.updateUser({
    data: { ...meta, custom_avatar_url: null },
  })
  if (error) throw error
}

async function saveCustomAvatarUrl(user: User, url: string): Promise<void> {
  const meta = (user.user_metadata ?? {}) as GoogleLikeMetadata
  const { error } = await supabase.auth.updateUser({
    data: { ...meta, custom_avatar_url: url },
  })
  if (error) throw error
}

function guessImageExtension(file: File): string {
  const nameExt = file.name.split('.').pop()?.toLowerCase()
  if (nameExt && /^[a-z0-9]{2,4}$/.test(nameExt)) return nameExt
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  if (file.type === 'image/heic') return 'heic'
  return 'jpg'
}
