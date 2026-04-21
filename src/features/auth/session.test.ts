import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithOAuth = vi.fn()
const openAuthUrl = vi.fn()
const platformState = { isNative: false }

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: (args: unknown) => signInWithOAuth(args),
    },
  },
}))

vi.mock('../platform', () => ({
  platform: {
    get isNative() {
      return platformState.isNative
    },
    openAuthUrl: (url: string) => openAuthUrl(url),
  },
}))

const { signInWithGoogle, NATIVE_AUTH_REDIRECT } = await import('./session')

describe('signInWithGoogle', () => {
  beforeEach(() => {
    signInWithOAuth.mockReset()
    openAuthUrl.mockReset().mockResolvedValue(undefined)
    platformState.isNative = false
  })

  it('on web: lets Supabase handle the redirect (no manual browser open)', async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/oauth/...' },
      error: null,
    })

    await signInWithGoogle()

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: expect.stringMatching(/\/auth\/callback$/),
        skipBrowserRedirect: false,
        queryParams: { prompt: 'select_account' },
      }),
    })
    expect(openAuthUrl).not.toHaveBeenCalled()
  })

  it('on native: requests skipBrowserRedirect and opens the URL via the platform', async () => {
    platformState.isNative = true
    signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/oauth/native' },
      error: null,
    })

    await signInWithGoogle()

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: NATIVE_AUTH_REDIRECT,
        skipBrowserRedirect: true,
      }),
    })
    expect(openAuthUrl).toHaveBeenCalledWith(
      'https://accounts.google.com/oauth/native',
    )
  })

  it('on native: throws if Supabase returns no URL', async () => {
    platformState.isNative = true
    signInWithOAuth.mockResolvedValue({ data: null, error: null })

    await expect(signInWithGoogle()).rejects.toThrow(/No OAuth URL/i)
    expect(openAuthUrl).not.toHaveBeenCalled()
  })

  it('propagates Supabase errors', async () => {
    signInWithOAuth.mockResolvedValue({
      data: null,
      error: new Error('oauth init failed'),
    })

    await expect(signInWithGoogle()).rejects.toThrow('oauth init failed')
  })
})
