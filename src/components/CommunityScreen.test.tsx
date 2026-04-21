import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Club, ClubEvent } from '../types/club'

const listClubsMock = vi.fn<() => Promise<Club[]>>().mockResolvedValue([])
const listMyClubsMock = vi.fn<() => Promise<Club[]>>().mockResolvedValue([])
const listUpcomingMock = vi
  .fn<() => Promise<ClubEvent[]>>()
  .mockResolvedValue([])

vi.mock('../features/community/clubs', () => ({
  listClubs: () => listClubsMock(),
  listMyClubs: () => listMyClubsMock(),
}))

vi.mock('../features/community/events', () => ({
  listUpcomingEventsForMyClubs: () => listUpcomingMock(),
}))

import CommunityScreen from './CommunityScreen'

describe('CommunityScreen', () => {
  beforeEach(() => {
    listClubsMock.mockReset().mockResolvedValue([])
    listMyClubsMock.mockReset().mockResolvedValue([])
    listUpcomingMock.mockReset().mockResolvedValue([])
  })

  it('renders the community heading and host tab by default', async () => {
    render(
      <MemoryRouter>
        <CommunityScreen />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /find your/i,
    )
    expect(screen.getByRole('tab', { name: /host/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      await screen.findByRole('link', { name: /start a club/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/host tools/i)).toBeInTheDocument()
  })

  it('switches to clubs panel when Clubs tab is activated', async () => {
    render(
      <MemoryRouter>
        <CommunityScreen />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('tab', { name: /clubs/i }))
    expect(screen.getByRole('tab', { name: /clubs/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      await screen.findByRole('link', { name: /new club/i }),
    ).toBeInTheDocument()
  })

  it('shows My clubs + Discover sections when the user has joined clubs', async () => {
    const mine: Club[] = [
      {
        id: 'c1',
        name: 'Twisties',
        description: null,
        city: 'Bay Area',
        accent: 'sunrise',
        createdBy: 'u1',
        memberCount: 12,
        createdAt: Date.now(),
      },
    ]
    const all: Club[] = [
      ...mine,
      {
        id: 'c2',
        name: 'Iron Compass',
        description: null,
        city: null,
        accent: 'ocean',
        createdBy: 'u2',
        memberCount: 4,
        createdAt: Date.now(),
      },
    ]
    listClubsMock.mockResolvedValue(all)
    listMyClubsMock.mockResolvedValue(mine)

    render(
      <MemoryRouter>
        <CommunityScreen />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('tab', { name: /clubs/i }))

    await waitFor(() =>
      expect(screen.getByText(/my clubs/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/discover/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /twisties/i })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /iron compass/i }),
    ).toBeInTheDocument()
  })

  it('offers "Create a ride" on Host when the user has a club', async () => {
    const mine: Club[] = [
      {
        id: 'c1',
        name: 'Twisties',
        description: null,
        city: null,
        accent: 'sunrise',
        createdBy: 'u1',
        memberCount: 3,
        createdAt: Date.now(),
      },
    ]
    listMyClubsMock.mockResolvedValue(mine)
    listClubsMock.mockResolvedValue(mine)

    render(
      <MemoryRouter>
        <CommunityScreen />
      </MemoryRouter>,
    )
    const link = await screen.findByRole('link', { name: /create a ride/i })
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('/community/events/new'),
    )
    expect(link.getAttribute('href')).toContain('clubId=c1')
  })
})
