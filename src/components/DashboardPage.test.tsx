import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'

vi.mock('../features/auth/session', () => ({
  getSession: vi.fn().mockResolvedValue({
    user: {
      email: 'owner@example.com',
      user_metadata: { full_name: 'Owner' },
    },
  }),
  onAuthChange: (() => () => {}) as (cb: (s: Session | null) => void) => () => void,
  signOut: vi.fn(),
}))

vi.mock('../features/admin/stats', () => ({
  checkIsAdmin: vi.fn().mockResolvedValue(false),
  loadAdminDashboard: vi.fn(),
}))

import DashboardPage from './DashboardPage'

describe('DashboardPage', () => {
  it('renders the nav with rider email, Open app link, and Sign out', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('owner@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open app/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})
