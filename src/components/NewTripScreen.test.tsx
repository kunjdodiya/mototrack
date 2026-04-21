import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const createTripMock = vi.fn().mockResolvedValue({
  id: 'new-trip',
  name: 'Ladakh 2026',
  coverColor: 'sunrise',
  notes: null,
  createdAt: 0,
  syncedAt: null,
})
const addRideToTripMock = vi.fn().mockResolvedValue(undefined)

vi.mock('../features/trips/trips', () => ({
  createTrip: (input: unknown) => createTripMock(input),
  addRideToTrip: (rideId: string, tripId: string) =>
    addRideToTripMock(rideId, tripId),
}))

import NewTripScreen from './NewTripScreen'

describe('NewTripScreen', () => {
  it('disables submit until a name is entered, then creates the trip', async () => {
    render(
      <MemoryRouter initialEntries={['/trips/new']}>
        <Routes>
          <Route path="/trips/new" element={<NewTripScreen />} />
          <Route path="/trips/:id" element={<div>trip-page</div>} />
        </Routes>
      </MemoryRouter>,
    )
    const submit = screen.getByRole('button', { name: /create trip/i })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText(/ladakh 2026/i), {
      target: { value: 'Ladakh 2026' },
    })
    expect(submit).not.toBeDisabled()
    fireEvent.click(submit)

    await waitFor(() => expect(createTripMock).toHaveBeenCalledTimes(1))
    const [input] = createTripMock.mock.calls[0]
    expect(input).toMatchObject({ name: 'Ladakh 2026', coverColor: 'sunrise' })
    expect(await screen.findByText('trip-page')).toBeInTheDocument()
  })

  it('attaches the ride when ?rideId= is present', async () => {
    render(
      <MemoryRouter initialEntries={['/trips/new?rideId=ride-7']}>
        <Routes>
          <Route path="/trips/new" element={<NewTripScreen />} />
          <Route path="/trips/:id" element={<div>trip-page</div>} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText(/ladakh 2026/i), {
      target: { value: 'Coastal' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /create trip \+ add ride/i }),
    )
    await waitFor(() => expect(addRideToTripMock).toHaveBeenCalledTimes(1))
    expect(addRideToTripMock).toHaveBeenCalledWith('ride-7', 'new-trip')
  })
})
