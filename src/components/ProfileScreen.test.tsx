import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import ProfileScreen from './ProfileScreen'

const onAuthChangeCbs: Array<(s: Session | null) => void> = []

vi.mock('../features/auth/session', () => ({
  getSession: vi.fn().mockResolvedValue({
    user: {
      email: 'rider@example.com',
      user_metadata: {
        full_name: 'Jamie Rider',
        avatar_url: 'https://g.test/me.jpg',
      },
    },
  }),
  onAuthChange: (cb: (s: Session | null) => void) => {
    onAuthChangeCbs.push(cb)
    return () => {
      const i = onAuthChangeCbs.indexOf(cb)
      if (i >= 0) onAuthChangeCbs.splice(i, 1)
    }
  },
}))

vi.mock('../features/storage/db', () => ({
  db: {
    rides: { toArray: vi.fn().mockResolvedValue([]) },
    bikes: { orderBy: () => ({ toArray: vi.fn().mockResolvedValue([]) }) },
  },
}))

vi.mock('../features/storage/bikes', () => ({
  addBike: vi.fn(),
  deleteBike: vi.fn(),
}))

vi.mock('../features/storage/sync', () => ({
  pushBike: vi.fn(),
}))

vi.mock('../features/storage/documents', () => ({
  listDocuments: vi.fn().mockResolvedValue([]),
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  getDocumentViewUrl: vi.fn(),
}))

vi.mock('../features/storage/profile', () => ({
  getProfileInfo: (session: Session | null) => {
    const u = session?.user as
      | { email?: string; user_metadata?: Record<string, string | undefined> }
      | undefined
    if (!u) return { name: null, email: null, avatarUrl: null }
    const meta = u.user_metadata ?? {}
    return {
      name: meta.full_name ?? meta.name ?? null,
      email: u.email ?? null,
      avatarUrl:
        meta.custom_avatar_url ?? meta.avatar_url ?? meta.picture ?? null,
    }
  },
  uploadAvatar: vi.fn(),
  resetAvatar: vi.fn(),
}))

describe('ProfileScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onAuthChangeCbs.length = 0
  })

  it('renders the profile heading, name, email and totals section', async () => {
    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: /jamie rider/i })).toBeInTheDocument()
    expect(await screen.findByText('rider@example.com')).toBeInTheDocument()
    expect(screen.getByText(/totals/i)).toBeInTheDocument()
    expect(screen.getByText(/my bikes/i)).toBeInTheDocument()
    expect(screen.getByText(/legal documents/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change photo/i })).toBeInTheDocument()
  })
})
