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

import AuthGate from './AuthGate'

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
})
