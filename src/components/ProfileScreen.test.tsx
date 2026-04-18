import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProfileScreen from './ProfileScreen'

vi.mock('../features/auth/session', () => ({
  getSession: vi.fn().mockResolvedValue({ user: { email: 'rider@example.com' } }),
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

describe('ProfileScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the profile heading and totals section', async () => {
    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /my profile/i })).toBeInTheDocument()
    expect(screen.getByText(/totals/i)).toBeInTheDocument()
    expect(screen.getByText(/my bikes/i)).toBeInTheDocument()
    expect(await screen.findByText('rider@example.com')).toBeInTheDocument()
  })
})
