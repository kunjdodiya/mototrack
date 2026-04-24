import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Club, ClubEvent } from '../types/club'

type ListClubsArgs = { cityLike?: string | null } | undefined
const listClubsMock = vi
  .fn<(args?: ListClubsArgs) => Promise<Club[]>>()
  .mockResolvedValue([])
const listMyClubsMock = vi.fn<() => Promise<Club[]>>().mockResolvedValue([])
const listUpcomingMock = vi
  .fn<() => Promise<ClubEvent[]>>()
  .mockResolvedValue([])
const getUserIdMock = vi
  .fn<() => Promise<string | null>>()
  .mockResolvedValue('user-1')

vi.mock('../features/community/clubs', () => ({
  listClubs: (args?: ListClubsArgs) => listClubsMock(args),
  listMyClubs: () => listMyClubsMock(),
}))

vi.mock('../features/community/events', () => ({
  listUpcomingEventsForMyClubs: () => listUpcomingMock(),
}))

vi.mock('../features/auth/session', () => ({
  getUserId: () => getUserIdMock(),
}))

import CommunityScreen from './CommunityScreen'

describe('CommunityScreen', () => {
  beforeEach(() => {
    listClubsMock.mockReset().mockResolvedValue([])
    listMyClubsMock.mockReset().mockResolvedValue([])
    listUpcomingMock.mockReset().mockResolvedValue([])
    getUserIdMock.mockReset().mockResolvedValue('user-1')
    window.localStorage.clear()
  })

  it('renders the community heading and Clubs tab by default', async () => {
    render(
      <MemoryRouter>
        <CommunityScreen />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /find your/i,
    )
    expect(screen.getByRole('tab', { name: /^clubs$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      await screen.findByRole('button', { name: /change location filter/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/discover/i)).toBeInTheDocument()
  })

  it('switches to Club Manager panel when the manager tab is activated', async () => {
    render(
      <MemoryRouter>
        <CommunityScreen />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('tab', { name: /club manager/i }))
    expect(screen.getByRole('tab', { name: /club manager/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      await screen.findByRole('link', { name: /start a club/i }),
    ).toBeInTheDocument()
  })

  it('shows My clubs pinned above Discover when the user has joined clubs', async () => {
    const mine: Club[] = [
      {
        id: 'c1',
        name: 'Twisties',
        description: null,
        city: 'Bay Area',
        accent: 'sunrise',
        createdBy: 'user-1',
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
    await waitFor(() =>
      expect(screen.getByText(/my clubs/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/discover/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /twisties/i })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /iron compass/i }),
    ).toBeInTheDocument()
  })

  it('passes the stored location to listClubs and labels the section "Near [city]"', async () => {
    window.localStorage.setItem('mototrack:community-location', 'San Francisco')
    render(
      <MemoryRouter>
        <CommunityScreen />
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(listClubsMock).toHaveBeenCalledWith({
        cityLike: 'San Francisco',
      }),
    )
    expect(screen.getByText(/near san francisco/i)).toBeInTheDocument()
  })

  it('refetches clubs with the new city after saving the location picker', async () => {
    render(
      <MemoryRouter>
        <CommunityScreen />
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(listClubsMock).toHaveBeenCalledWith({ cityLike: null }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /change location filter/i }),
    )
    fireEvent.change(screen.getByLabelText(/city, area, or country/i), {
      target: { value: 'Mumbai' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(listClubsMock).toHaveBeenCalledWith({ cityLike: 'Mumbai' }),
    )
  })

  it('Club Manager surfaces "Create a ride" deep-linked to an owned club', async () => {
    const mine: Club[] = [
      {
        id: 'c1',
        name: 'Twisties',
        description: null,
        city: null,
        accent: 'sunrise',
        createdBy: 'user-1',
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
    fireEvent.click(screen.getByRole('tab', { name: /club manager/i }))
    const link = await screen.findByRole('link', { name: /create a ride/i })
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('/community/events/new'),
    )
    expect(link.getAttribute('href')).toContain('clubId=c1')
    expect(
      screen.getByRole('heading', { name: /my clubs \(managed\)/i }),
    ).toBeInTheDocument()
  })

  it('Club Manager nudges the user to start a club when they manage none', async () => {
    const mine: Club[] = [
      {
        id: 'c1',
        name: 'Someone Else\u2019s Club',
        description: null,
        city: null,
        accent: 'sunrise',
        createdBy: 'other-user',
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
    fireEvent.click(screen.getByRole('tab', { name: /club manager/i }))
    const link = await screen.findByRole('link', { name: /start a club/i })
    expect(link).toHaveAttribute('href', '/community/clubs/new')
    expect(
      screen.getByText(/you don't manage a club yet/i),
    ).toBeInTheDocument()
  })
})
