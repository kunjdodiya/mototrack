import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Club, ClubEvent, RsvpStatus } from '../types/club'

const getEventMock = vi.fn<() => Promise<ClubEvent | null>>()
const getClubMock = vi.fn<() => Promise<Club | null>>()
const getMyRsvpMock = vi
  .fn<() => Promise<RsvpStatus | null>>()
  .mockResolvedValue(null)
const setMyRsvpMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
const clearMyRsvpMock = vi
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined)
const deleteEventMock = vi
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined)
const getUserIdMock = vi
  .fn<() => Promise<string | null>>()
  .mockResolvedValue('user-2')

vi.mock('../features/community/events', () => ({
  getEvent: () => getEventMock(),
  getMyRsvp: () => getMyRsvpMock(),
  setMyRsvp: (...args: unknown[]) => setMyRsvpMock(...(args as [])),
  clearMyRsvp: () => clearMyRsvpMock(),
  deleteEvent: () => deleteEventMock(),
}))

vi.mock('../features/community/clubs', () => ({
  getClub: () => getClubMock(),
}))

vi.mock('../features/auth/session', () => ({
  getUserId: () => getUserIdMock(),
}))

import EventDetailScreen from './EventDetailScreen'

function sampleEvent(overrides: Partial<ClubEvent> = {}): ClubEvent {
  return {
    id: 'e1',
    clubId: 'c1',
    title: 'Morning loop',
    description: 'Pack light, show up caffeinated.',
    startAt: Date.now() + 2 * 24 * 3600_000,
    meetLabel: "Peet's on Skyline",
    meetLat: null,
    meetLng: null,
    createdBy: 'host-1',
    goingCount: 5,
    createdAt: Date.now(),
    ...overrides,
  }
}

function sampleClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'c1',
    name: 'Twisties',
    description: null,
    city: null,
    accent: 'sunrise',
    createdBy: 'host-1',
    memberCount: 5,
    createdAt: Date.now(),
    ...overrides,
  }
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/community/events/:id"
          element={<EventDetailScreen />}
        />
        <Route
          path="/community/clubs/:id"
          element={<div>club detail</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('EventDetailScreen', () => {
  beforeEach(() => {
    getEventMock.mockReset()
    getClubMock.mockReset()
    getMyRsvpMock.mockReset().mockResolvedValue(null)
    setMyRsvpMock.mockReset().mockResolvedValue(undefined)
    clearMyRsvpMock.mockReset().mockResolvedValue(undefined)
    deleteEventMock.mockReset().mockResolvedValue(undefined)
    getUserIdMock.mockReset().mockResolvedValue('user-2')
  })

  it('shows not-found when the event is missing', async () => {
    getEventMock.mockResolvedValue(null)
    renderAt('/community/events/missing')
    await waitFor(() =>
      expect(screen.getByText(/doesn't exist anymore/i)).toBeInTheDocument(),
    )
  })

  it('renders title + going count + RSVP options when loaded', async () => {
    getEventMock.mockResolvedValue(sampleEvent())
    getClubMock.mockResolvedValue(sampleClub())
    renderAt('/community/events/e1')
    expect(
      await screen.findByRole('heading', { level: 1, name: /morning loop/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/5 going/i)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^going$/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^maybe$/i })).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: /^not going$/i }),
    ).toBeInTheDocument()
  })

  it('optimistically bumps going count and calls setMyRsvp on Going tap', async () => {
    getEventMock.mockResolvedValue(sampleEvent())
    getClubMock.mockResolvedValue(sampleClub())
    renderAt('/community/events/e1')

    const goingBtn = await screen.findByRole('radio', { name: /^going$/i })
    fireEvent.click(goingBtn)

    await waitFor(() => expect(setMyRsvpMock).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.getByText(/6 going/i)).toBeInTheDocument(),
    )
  })

  it('shows the Cancel ride button only when the current user is the host', async () => {
    getEventMock.mockResolvedValue(sampleEvent())
    getClubMock.mockResolvedValue(sampleClub())
    getUserIdMock.mockResolvedValue('host-1')
    renderAt('/community/events/e1')
    expect(
      await screen.findByRole('button', { name: /cancel ride/i }),
    ).toBeInTheDocument()
  })

  it('hides the Cancel ride button for non-hosts', async () => {
    getEventMock.mockResolvedValue(sampleEvent())
    getClubMock.mockResolvedValue(sampleClub())
    getUserIdMock.mockResolvedValue('user-2')
    renderAt('/community/events/e1')
    await screen.findByRole('heading', { level: 1, name: /morning loop/i })
    expect(screen.queryByRole('button', { name: /cancel ride/i })).toBeNull()
  })
})
