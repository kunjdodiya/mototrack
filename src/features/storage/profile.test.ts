import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Session } from '@supabase/supabase-js'

const uploadSpy = vi.fn().mockResolvedValue({ error: null })
const getPublicUrlSpy = vi.fn().mockReturnValue({
  data: { publicUrl: 'https://example.test/storage/v1/object/public/avatars/u-1/avatar-1.jpg' },
})
const updateUserSpy = vi.fn().mockResolvedValue({ error: null })
let currentSession: Session | null = null

vi.mock('../auth/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: currentSession } }),
      updateUser: (payload: unknown) => updateUserSpy(payload),
    },
    storage: {
      from: () => ({
        upload: (path: string, file: File, opts: unknown) => uploadSpy(path, file, opts),
        getPublicUrl: (path: string) => getPublicUrlSpy(path),
      }),
    },
  },
}))

import { getProfileInfo, uploadAvatar, resetAvatar } from './profile'

function session(meta: Record<string, unknown>, id = 'u-1'): Session {
  return {
    access_token: 'a',
    refresh_token: 'r',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: meta,
      created_at: new Date().toISOString(),
      email: 'rider@example.com',
    },
  } as unknown as Session
}

describe('getProfileInfo', () => {
  it('returns null triple when no session', () => {
    expect(getProfileInfo(null)).toEqual({
      name: null,
      email: null,
      avatarUrl: null,
    })
  })

  it('picks full_name and avatar_url from Google metadata', () => {
    const s = session({
      full_name: 'Jamie Rider',
      avatar_url: 'https://g.test/me.jpg',
    })
    expect(getProfileInfo(s)).toEqual({
      name: 'Jamie Rider',
      email: 'rider@example.com',
      avatarUrl: 'https://g.test/me.jpg',
    })
  })

  it('prefers custom_avatar_url over the Google avatar', () => {
    const s = session({
      full_name: 'Jamie Rider',
      avatar_url: 'https://g.test/me.jpg',
      custom_avatar_url: 'https://storage.test/custom.jpg',
    })
    expect(getProfileInfo(s).avatarUrl).toBe('https://storage.test/custom.jpg')
  })

  it('falls back to "name" and "picture" when full_name/avatar_url are absent', () => {
    const s = session({ name: 'Alex', picture: 'https://g.test/alex.jpg' })
    expect(getProfileInfo(s)).toMatchObject({
      name: 'Alex',
      avatarUrl: 'https://g.test/alex.jpg',
    })
  })
})

describe('uploadAvatar', () => {
  beforeEach(() => {
    uploadSpy.mockClear()
    getPublicUrlSpy.mockClear()
    updateUserSpy.mockClear()
    currentSession = session({ full_name: 'Jamie Rider' })
  })

  it('rejects non-image files', async () => {
    const file = new File(['x'], 'readme.txt', { type: 'text/plain' })
    await expect(uploadAvatar(file)).rejects.toThrow(/must be an image/)
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('rejects files larger than 5 MB', async () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    })
    await expect(uploadAvatar(big)).rejects.toThrow(/5 MB/)
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('uploads to a user-scoped path and saves custom_avatar_url on the user', async () => {
    const file = new File([new Uint8Array(16)], 'me.jpg', { type: 'image/jpeg' })
    const url = await uploadAvatar(file)

    expect(uploadSpy).toHaveBeenCalledTimes(1)
    const [path, , opts] = uploadSpy.mock.calls[0]
    expect(path).toMatch(/^u-1\/avatar-\d+\.jpg$/)
    expect(opts).toMatchObject({ contentType: 'image/jpeg', upsert: true })

    expect(updateUserSpy).toHaveBeenCalledTimes(1)
    const payload = updateUserSpy.mock.calls[0][0] as { data: { custom_avatar_url: string } }
    expect(payload.data.custom_avatar_url).toMatch(/^https:\/\/example\.test\//)
    expect(url).toContain('?v=')
  })

  it('throws when no session is present', async () => {
    currentSession = null
    const file = new File([new Uint8Array(4)], 'me.jpg', { type: 'image/jpeg' })
    await expect(uploadAvatar(file)).rejects.toThrow(/signed in/i)
  })
})

describe('resetAvatar', () => {
  beforeEach(() => {
    updateUserSpy.mockClear()
  })

  it('clears the custom avatar URL in user metadata', async () => {
    currentSession = session({
      full_name: 'Jamie Rider',
      custom_avatar_url: 'https://storage.test/c.jpg',
    })
    await resetAvatar()
    expect(updateUserSpy).toHaveBeenCalledTimes(1)
    const payload = updateUserSpy.mock.calls[0][0] as { data: { custom_avatar_url: string | null } }
    expect(payload.data.custom_avatar_url).toBeNull()
  })

  it('is a no-op when no custom avatar is set', async () => {
    currentSession = session({ full_name: 'Jamie Rider' })
    await resetAvatar()
    expect(updateUserSpy).not.toHaveBeenCalled()
  })
})
