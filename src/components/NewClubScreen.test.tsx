import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Club } from '../types/club'

const createClubMock = vi.fn<(input: unknown) => Promise<Club>>()

vi.mock('../features/community/clubs', () => ({
  createClub: (input: unknown) => createClubMock(input),
}))

import NewClubScreen from './NewClubScreen'

describe('NewClubScreen', () => {
  beforeEach(() => {
    createClubMock.mockReset()
  })

  it('submits the form and navigates to the new club detail on success', async () => {
    createClubMock.mockResolvedValue({
      id: 'new-club-id',
      name: 'Twisties',
      description: null,
      city: null,
      accent: 'sunrise',
      createdBy: 'u1',
      memberCount: 1,
      createdAt: Date.now(),
    })

    render(
      <MemoryRouter initialEntries={['/community/clubs/new']}>
        <Routes>
          <Route path="/community/clubs/new" element={<NewClubScreen />} />
          <Route
            path="/community/clubs/:id"
            element={<div>club detail for new-club-id</div>}
          />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText(/twisties/i), {
      target: { value: 'Twisties' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create club/i }))

    await waitFor(() => expect(createClubMock).toHaveBeenCalledTimes(1))
    expect(createClubMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Twisties', accent: 'sunrise' }),
    )
    await screen.findByText(/club detail for new-club-id/)
  })

  it('disables the submit button when the name is blank', () => {
    render(
      <MemoryRouter>
        <NewClubScreen />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /create club/i })).toBeDisabled()
  })
})
