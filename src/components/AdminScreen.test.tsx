import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { AdminDashboard } from '../types/admin'

const checkIsAdminSpy = vi.fn()
const loadAdminDashboardSpy = vi.fn()

vi.mock('../features/admin/stats', () => ({
  checkIsAdmin: () => checkIsAdminSpy(),
  loadAdminDashboard: () => loadAdminDashboardSpy(),
}))

import AdminScreen from './AdminScreen'

function dashboard(overrides: Partial<AdminDashboard> = {}): AdminDashboard {
  return {
    generatedAt: new Date('2026-04-23T12:00:00Z').getTime(),
    users: { total: 42, newToday: 3, newLast7: 10, newLast30: 25 },
    activeUsers: { dau: 5, wau: 18, mau: 30 },
    rides: {
      total: 137,
      totalDistanceMeters: 1_234_000,
      totalDurationMs: 10 * 3600_000,
      totalMovingMs: 8 * 3600_000,
      riddenToday: 4,
      riddenLast7: 22,
      riddenLast30: 88,
    },
    content: {
      bikeCount: 12,
      tripCount: 4,
      clubCount: 2,
      eventCount: 6,
      rsvpCount: 18,
    },
    signupsLast30: [
      { date: '2026-03-25', count: 0 },
      { date: '2026-04-23', count: 3 },
    ],
    topRiders: [
      {
        userId: 'u-1',
        email: 'alice@example.com',
        name: 'Alice Rider',
        rideCount: 25,
        totalDistanceMeters: 800_000,
        totalDurationMs: 5 * 3600_000,
      },
    ],
    recentUsers: [
      {
        userId: 'u-2',
        email: 'bob@example.com',
        name: 'Bob',
        createdAt: new Date('2026-04-22T10:00:00Z').getTime(),
        lastSignInAt: new Date('2026-04-23T08:00:00Z').getTime(),
        rideCount: 3,
      },
    ],
    ...overrides,
  }
}

describe('AdminScreen', () => {
  beforeEach(() => {
    checkIsAdminSpy.mockReset()
    loadAdminDashboardSpy.mockReset()
  })

  it('renders the ready state with headline numbers and section headings', async () => {
    checkIsAdminSpy.mockResolvedValue(true)
    loadAdminDashboardSpy.mockResolvedValue(dashboard())

    render(
      <MemoryRouter>
        <AdminScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText('42')).toBeInTheDocument(),
    )
    expect(screen.getByText(/active riders/i)).toBeInTheDocument()
    expect(screen.getByText(/top riders/i)).toBeInTheDocument()
    expect(screen.getByText(/recent signups/i)).toBeInTheDocument()
    expect(screen.getByText('Alice Rider')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
  })

  it('renders the forbidden state when the user is not an admin', async () => {
    checkIsAdminSpy.mockResolvedValue(false)

    render(
      <MemoryRouter>
        <AdminScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /not authorized/i })).toBeInTheDocument()
    expect(loadAdminDashboardSpy).not.toHaveBeenCalled()
  })

  it('renders the error state when the RPC throws', async () => {
    checkIsAdminSpy.mockResolvedValue(true)
    loadAdminDashboardSpy.mockRejectedValue(new Error('network down'))

    render(
      <MemoryRouter>
        <AdminScreen />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: /couldn't load dashboard/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/network down/i)).toBeInTheDocument()
  })
})
