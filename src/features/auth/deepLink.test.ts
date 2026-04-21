import { describe, it, expect, vi, beforeEach } from 'vitest'

const exchangeCodeForSession = vi.fn()
const closeAuthBrowser = vi.fn()
const onAppUrl = vi.fn()

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (code: string) =>
        exchangeCodeForSession(code),
    },
  },
}))

vi.mock('../platform', () => ({
  platform: {
    closeAuthBrowser: () => closeAuthBrowser(),
    onAppUrl: (cb: (url: string) => void) => onAppUrl(cb),
  },
}))

import {
  handleAuthDeepLink,
  startAuthDeepLinkListener,
} from './deepLink'

describe('handleAuthDeepLink', () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null })
    closeAuthBrowser.mockReset().mockResolvedValue(undefined)
    onAppUrl.mockReset().mockReturnValue(() => {})
  })

  it('returns false for non-auth URLs', async () => {
    const handled = await handleAuthDeepLink(
      'com.kunjdodiya.mototrack://share/ride/123',
    )
    expect(handled).toBe(false)
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(closeAuthBrowser).not.toHaveBeenCalled()
  })

  it('returns false for malformed URLs', async () => {
    const handled = await handleAuthDeepLink('not a url')
    expect(handled).toBe(false)
  })

  it('exchanges PKCE code from query string and closes the browser', async () => {
    const handled = await handleAuthDeepLink(
      'com.kunjdodiya.mototrack://auth/callback?code=abc123',
    )
    expect(handled).toBe(true)
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123')
    expect(closeAuthBrowser).toHaveBeenCalledOnce()
  })

  it('exchanges code from the URL fragment too', async () => {
    const handled = await handleAuthDeepLink(
      'com.kunjdodiya.mototrack://auth/callback#code=xyz',
    )
    expect(handled).toBe(true)
    expect(exchangeCodeForSession).toHaveBeenCalledWith('xyz')
  })

  it('still closes the browser if exchange throws', async () => {
    exchangeCodeForSession.mockRejectedValueOnce(new Error('bad code'))
    await expect(
      handleAuthDeepLink('com.kunjdodiya.mototrack://auth/callback?code=x'),
    ).rejects.toThrow('bad code')
    expect(closeAuthBrowser).toHaveBeenCalledOnce()
  })

  it('handles OAuth error redirect by closing the browser without exchange', async () => {
    const handled = await handleAuthDeepLink(
      'com.kunjdodiya.mototrack://auth/callback?error=access_denied',
    )
    expect(handled).toBe(true)
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(closeAuthBrowser).toHaveBeenCalledOnce()
  })
})

describe('startAuthDeepLinkListener', () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null })
    closeAuthBrowser.mockReset().mockResolvedValue(undefined)
    onAppUrl.mockReset()
  })

  it('subscribes via the platform adapter and forwards URLs to the handler', async () => {
    let captured: ((url: string) => void) | null = null
    const unsub = vi.fn()
    onAppUrl.mockImplementation((cb: (url: string) => void) => {
      captured = cb
      return unsub
    })

    const stop = startAuthDeepLinkListener()
    expect(onAppUrl).toHaveBeenCalledOnce()
    expect(captured).not.toBeNull()

    captured!('com.kunjdodiya.mototrack://auth/callback?code=t')
    // Allow microtask queue to drain.
    await Promise.resolve()
    await Promise.resolve()
    expect(exchangeCodeForSession).toHaveBeenCalledWith('t')

    stop()
    expect(unsub).toHaveBeenCalledOnce()
  })
})
