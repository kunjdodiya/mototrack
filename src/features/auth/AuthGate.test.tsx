import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'

let currentSession: Session | null = null
const onAuthChangeCbs: Array<(s: Session | null) => void> = []

vi.mock('./session', () => ({
  getSession: () => Promise.resolve(currentSession),
  getUserId: () => Promise.resolve(currentSession?.user?.id ?? null),
  onAuthChange: (cb: (s: Session | null) => void) => {
    onAuthChangeCbs.push(cb)
    return () => {
      const i = onAuthChangeCbs.indexOf(cb)
      if (i >= 0) onAuthChangeCbs.splice(i, 1)
    }
  },
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../storage/sync', () => ({
  syncWithCloud: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../storage/liveSync', () => ({
  startLiveSync: vi.fn(() => () => {}),
}))

vi.mock('../storage/db', () => ({
  clearLocalUserData: vi.fn().mockResolvedValue(undefined),
}))

import AuthGate from './AuthGate'
import { clearLocalUserData } from '../storage/db'

function fakeSession(id: string): Session {
  return {
    access_token: 'a',
    refresh_token: 'r',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
      email: 'rider@example.com',
    },
  } as unknown as Session
}

describe('AuthGate', () => {
  beforeEach(() => {
    currentSession = null
    onAuthChangeCbs.length = 0
    window.localStorage.clear()
    vi.mocked(clearLocalUserData).mockClear()
  })

  it('shows the sign-in screen when no session is present', async () => {
    render(
      <MemoryRouter>
        <AuthGate>
          <div>app content</div>
        </AuthGate>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument()
    })
    expect(screen.queryByText('app content')).not.toBeInTheDocument()
  })

  it('renders children once a session exists', async () => {
    currentSession = fakeSession('user-1')
    render(
      <MemoryRouter>
        <AuthGate>
          <div>app content</div>
        </AuthGate>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('app content')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Continue with Google/i)).not.toBeInTheDocument()
  })

  it('does not clear local Dexie on the first sign-in (no prior user on this device)', async () => {
    currentSession = fakeSession('user-1')
    render(
      <MemoryRouter>
        <AuthGate>
          <div>app content</div>
        </AuthGate>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('app content')).toBeInTheDocument()
    })
    expect(clearLocalUserData).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('mototrack:lastUserId')).toBe('user-1')
  })

  it('clears local Dexie when a different user signs in on the same device', async () => {
    window.localStorage.setItem('mototrack:lastUserId', 'user-1')
    currentSession = fakeSession('user-2')
    render(
      <MemoryRouter>
        <AuthGate>
          <div>app content</div>
        </AuthGate>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(clearLocalUserData).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(window.localStorage.getItem('mototrack:lastUserId')).toBe('user-2')
    })
  })

  it('does not clear local Dexie when the same user signs in again', async () => {
    window.localStorage.setItem('mototrack:lastUserId', 'user-1')
    currentSession = fakeSession('user-1')
    render(
      <MemoryRouter>
        <AuthGate>
          <div>app content</div>
        </AuthGate>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('app content')).toBeInTheDocument()
    })
    expect(clearLocalUserData).not.toHaveBeenCalled()
  })
})
