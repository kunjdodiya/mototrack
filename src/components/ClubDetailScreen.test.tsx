import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Club, ClubEvent } from '../types/club'

const getClubMock = vi.fn<() => Promise<Club | null>>()
const listEventsMock = vi
  .fn<() => Promise<ClubEvent[]>>()
  .mockResolvedValue([])
const isMemberMock = vi.fn<() => Promise<boolean>>().mockResolvedValue(false)
const joinClubMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
const leaveClubMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
const getUserIdMock = vi
  .fn<() => Promise<string | null>>()
  .mockResolvedValue('user-1')

vi.mock('../features/community/clubs', () => ({
  getClub: () => getClubMock(),
  isMember: () => isMemberMock(),
  joinClub: () => joinClubMock(),
  leaveClub: () => leaveClubMock(),
}))

vi.mock('../features/community/events', () => ({
  listUpcomingEventsForClub: () => listEventsMock(),
}))

vi.mock('../features/auth/session', () => ({
  getUserId: () => getUserIdMock(),
}))

import ClubDetailScreen from './ClubDetailScreen'

function sampleClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'c1',
    name: 'Twisties',
    description: 'Canyon runs',
    city: 'Bay Area',
    accent: 'sunrise',
    createdBy: 'owner-1',
    memberCount: 12,
    createdAt: Date.now(),
    ...overrides,
  }
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/community/clubs/:id" element={<ClubDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ClubDetailScreen', () => {
  beforeEach(() => {
    getClubMock.mockReset()
    listEventsMock.mockReset().mockResolvedValue([])
    isMemberMock.mockReset().mockResolvedValue(false)
    joinClubMock.mockReset().mockResolvedValue(undefined)
    leaveClubMock.mockReset().mockResolvedValue(undefined)
    getUserIdMock.mockReset().mockResolvedValue('user-1')
  })

  it('renders the not-found state when the club is missing', async () => {
    getClubMock.mockResolvedValue(null)
    renderAt('/community/clubs/missing')
    await waitFor(() =>
      expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument(),
    )
  })

  it('shows Join when the current user is not a member', async () => {
    getClubMock.mockResolvedValue(sampleClub())
    isMemberMock.mockResolvedValue(false)
    renderAt('/community/clubs/c1')
    expect(
      await screen.findByRole('button', { name: /join club/i }),
    ).toBeInTheDocument()
  })

  it('shows Leave + Host a ride when the current user is a member (non-owner)', async () => {
    getClubMock.mockResolvedValue(sampleClub({ createdBy: 'other' }))
    isMemberMock.mockResolvedValue(true)
    renderAt('/community/clubs/c1')
    expect(
      await screen.findByRole('link', { name: /host a ride/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /leave/i })).toBeInTheDocument()
  })

  it('hides Leave for the club owner but keeps Host a ride', async () => {
    getClubMock.mockResolvedValue(sampleClub({ createdBy: 'user-1' }))
    isMemberMock.mockResolvedValue(true)
    renderAt('/community/clubs/c1')
    expect(
      await screen.findByRole('link', { name: /host a ride/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /leave/i })).toBeNull()
  })

  it('calls joinClub when Join is tapped', async () => {
    getClubMock.mockResolvedValue(sampleClub())
    isMemberMock.mockResolvedValue(false)
    renderAt('/community/clubs/c1')
    const joinBtn = await screen.findByRole('button', { name: /join club/i })
    fireEvent.click(joinBtn)
    await waitFor(() => expect(joinClubMock).toHaveBeenCalledTimes(1))
  })
})
