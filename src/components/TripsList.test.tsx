import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Trip } from '../types/trip'
import type { Ride } from '../types/ride'

const trips: Trip[] = [
  {
    id: 'trip-1',
    name: 'Ladakh 2026',
    coverColor: 'aurora',
    notes: '6-session loop',
    createdAt: 2,
    syncedAt: null,
  },
  {
    id: 'trip-2',
    name: 'Coastal run',
    coverColor: 'sunrise',
    notes: null,
    createdAt: 1,
    syncedAt: null,
  },
]

const rides: Ride[] = [
  {
    id: 'r1',
    deviceId: 'd',
    startedAt: 1,
    endedAt: 3600_000,
    track: [],
    syncedAt: 10,
    tripId: 'trip-1',
    stats: {
      distanceMeters: 12_000,
      durationMs: 3600_000,
      movingDurationMs: 3000_000,
      idleDurationMs: 600_000,
      avgSpeedMps: null,
      maxSpeedMps: null,
      maxLeanAngleDeg: null,
      elevationGainMeters: null,
    },
  },
  {
    id: 'r2',
    deviceId: 'd',
    startedAt: 86_400_000,
    endedAt: 86_400_000 + 3600_000,
    track: [],
    syncedAt: 10,
    tripId: 'trip-1',
    stats: {
      distanceMeters: 8_000,
      durationMs: 3600_000,
      movingDurationMs: 2400_000,
      idleDurationMs: 1200_000,
      avgSpeedMps: null,
      maxSpeedMps: null,
      maxLeanAngleDeg: null,
      elevationGainMeters: null,
    },
  },
]

vi.mock('../features/storage/db', () => ({
  db: {
    trips: {
      orderBy: () => ({
        reverse: () => ({
          toArray: () =>
            Promise.resolve([...trips].sort((a, b) => b.createdAt - a.createdAt)),
        }),
      }),
    },
    rides: {
      toArray: () => Promise.resolve(rides),
    },
  },
}))

// `useLiveQuery` normally pipes through Dexie's observable layer; in the
// mocked setup we just run the query function once and return the value.
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: <T,>(fn: () => Promise<T>, _deps?: unknown[], initial?: T) => {
    const [value, setValue] = useState<T>(initial as T)
    useEffect(() => {
      let cancelled = false
      void fn().then((v) => {
        if (!cancelled) setValue(v)
      })
      return () => {
        cancelled = true
      }
    }, [fn])
    return value
  },
}))

import TripsList from './TripsList'

describe('TripsList', () => {
  it('renders the heading, new-trip CTA and a card per trip with combined stats', async () => {
    render(
      <MemoryRouter>
        <TripsList />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /multi-session/i,
    )
    expect(screen.getByRole('link', { name: /new trip/i })).toHaveAttribute(
      'href',
      '/trips/new',
    )
    expect(await screen.findByRole('link', { name: /ladakh 2026/i })).toHaveAttribute(
      'href',
      '/trips/trip-1',
    )
    expect(await screen.findByRole('link', { name: /coastal run/i })).toHaveAttribute(
      'href',
      '/trips/trip-2',
    )
    // Ladakh has two rides attached → "2 sessions"
    expect(screen.getByText(/2 sessions/i)).toBeInTheDocument()
    // Coastal has zero → "0 sessions"
    expect(screen.getByText(/0 sessions/i)).toBeInTheDocument()
    // Combined distance for Ladakh = 20,000 m = 20.0 km
    expect(screen.getByText(/20\.0 km/)).toBeInTheDocument()
  })
})
