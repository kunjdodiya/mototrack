import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Ride } from '../types/ride'
import type { Trip } from '../types/trip'

const rides: Ride[] = [
  // Free — can be selected.
  {
    id: 'r1',
    deviceId: 'd',
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_600_000,
    track: [],
    syncedAt: 10,
    name: 'Monsoon loop',
    stats: {
      distanceMeters: 12_000,
      durationMs: 600_000,
      movingDurationMs: 500_000,
      idleDurationMs: 100_000,
      avgSpeedMps: null,
      maxSpeedMps: null,
      maxLeanAngleDeg: null,
      elevationGainMeters: null,
    },
  },
  // Already in the current trip — hidden.
  {
    id: 'r2',
    deviceId: 'd',
    startedAt: 1_700_100_000_000,
    endedAt: 1_700_100_600_000,
    track: [],
    syncedAt: 10,
    tripId: 'trip-1',
    stats: {
      distanceMeters: 0,
      durationMs: 0,
      movingDurationMs: 0,
      idleDurationMs: 0,
      avgSpeedMps: null,
      maxSpeedMps: null,
      maxLeanAngleDeg: null,
      elevationGainMeters: null,
    },
  },
  // In a different trip — shown but disabled.
  {
    id: 'r3',
    deviceId: 'd',
    startedAt: 1_700_200_000_000,
    endedAt: 1_700_200_600_000,
    track: [],
    syncedAt: 10,
    tripId: 'trip-other',
    name: 'Coastal run',
    stats: {
      distanceMeters: 5_000,
      durationMs: 300_000,
      movingDurationMs: 250_000,
      idleDurationMs: 50_000,
      avgSpeedMps: null,
      maxSpeedMps: null,
      maxLeanAngleDeg: null,
      elevationGainMeters: null,
    },
  },
  // Free — can be selected.
  {
    id: 'r4',
    deviceId: 'd',
    startedAt: 1_700_300_000_000,
    endedAt: 1_700_300_600_000,
    track: [],
    syncedAt: 10,
    name: 'Canyon flick',
    stats: {
      distanceMeters: 8_000,
      durationMs: 400_000,
      movingDurationMs: 380_000,
      idleDurationMs: 20_000,
      avgSpeedMps: null,
      maxSpeedMps: null,
      maxLeanAngleDeg: null,
      elevationGainMeters: null,
    },
  },
]

const trips: Trip[] = [
  {
    id: 'trip-1',
    name: 'Ladakh 2026',
    coverColor: 'aurora',
    notes: null,
    createdAt: 0,
    syncedAt: null,
  },
  {
    id: 'trip-other',
    name: 'Goa Run',
    coverColor: 'sunrise',
    notes: null,
    createdAt: 0,
    syncedAt: null,
  },
]

const addRideToTripMock = vi.fn().mockResolvedValue(undefined)

vi.mock('../features/storage/rides', () => ({
  listRides: () => Promise.resolve(rides),
}))

vi.mock('../features/trips/trips', () => ({
  listTrips: () => Promise.resolve(trips),
  addRideToTrip: (rideId: string, tripId: string) =>
    addRideToTripMock(rideId, tripId),
}))

import AddRidesToTripSheet from './AddRidesToTripSheet'

describe('AddRidesToTripSheet', () => {
  beforeEach(() => {
    addRideToTripMock.mockReset().mockResolvedValue(undefined)
  })

  it('hides rides already in this trip and shows others, disabling those in another trip', async () => {
    render(
      <AddRidesToTripSheet
        tripId="trip-1"
        onClose={() => undefined}
        onAdded={() => undefined}
      />,
    )

    expect(await screen.findByRole('button', { name: /monsoon loop/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /canyon flick/i })).toBeEnabled()
    const inOtherTrip = screen.getByRole('button', { name: /coastal run/i })
    expect(inOtherTrip).toBeDisabled()
    expect(inOtherTrip).toHaveTextContent(/goa run/i)
    // r2 is hidden (already in trip-1)
    expect(screen.queryByText(/r2/)).not.toBeInTheDocument()
  })

  it('selects multiple rides, calls addRideToTrip once per ride, then closes', async () => {
    const onClose = vi.fn()
    const onAdded = vi.fn()
    render(
      <AddRidesToTripSheet
        tripId="trip-1"
        onClose={onClose}
        onAdded={onAdded}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: /monsoon loop/i }))
    fireEvent.click(screen.getByRole('button', { name: /canyon flick/i }))

    // Footer CTA reflects the count.
    const add = screen.getByRole('button', { name: /add 2 rides/i })
    fireEvent.click(add)

    await waitFor(() => expect(addRideToTripMock).toHaveBeenCalledTimes(2))
    expect(addRideToTripMock).toHaveBeenCalledWith('r1', 'trip-1')
    expect(addRideToTripMock).toHaveBeenCalledWith('r4', 'trip-1')
    expect(onAdded).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('disables the Add button until at least one ride is selected', async () => {
    render(
      <AddRidesToTripSheet
        tripId="trip-1"
        onClose={() => undefined}
        onAdded={() => undefined}
      />,
    )
    await screen.findByRole('button', { name: /monsoon loop/i })
    expect(screen.getByRole('button', { name: /add rides/i })).toBeDisabled()
  })

  it('Cancel invokes onClose', async () => {
    const onClose = vi.fn()
    render(
      <AddRidesToTripSheet
        tripId="trip-1"
        onClose={onClose}
        onAdded={() => undefined}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
