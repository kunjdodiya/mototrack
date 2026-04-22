import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcSpy = vi.fn()

vi.mock('../auth/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcSpy(...args),
  },
}))

import { checkIsAdmin, loadAdminDashboard } from './stats'

describe('checkIsAdmin', () => {
  beforeEach(() => {
    rpcSpy.mockReset()
  })

  it('returns true when the RPC resolves to true', async () => {
    rpcSpy.mockResolvedValueOnce({ data: true, error: null })
    expect(await checkIsAdmin()).toBe(true)
    expect(rpcSpy).toHaveBeenCalledWith('am_i_admin')
  })

  it('returns false when the RPC resolves to false', async () => {
    rpcSpy.mockResolvedValueOnce({ data: false, error: null })
    expect(await checkIsAdmin()).toBe(false)
  })

  it('swallows errors and returns false', async () => {
    rpcSpy.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    expect(await checkIsAdmin()).toBe(false)
  })
})

describe('loadAdminDashboard', () => {
  beforeEach(() => {
    rpcSpy.mockReset()
  })

  it('returns the payload on success', async () => {
    const payload = {
      generatedAt: 1_700_000_000_000,
      users: { total: 3, newToday: 0, newLast7: 1, newLast30: 2 },
      activeUsers: { dau: 1, wau: 2, mau: 3 },
      rides: {
        total: 9,
        totalDistanceMeters: 1000,
        totalDurationMs: 5000,
        totalMovingMs: 4000,
        riddenToday: 0,
        riddenLast7: 1,
        riddenLast30: 2,
      },
      content: {
        bikeCount: 0,
        tripCount: 0,
        clubCount: 0,
        eventCount: 0,
        rsvpCount: 0,
      },
      signupsLast30: [],
      topRiders: [],
      recentUsers: [],
    }
    rpcSpy.mockResolvedValueOnce({ data: payload, error: null })
    const out = await loadAdminDashboard()
    expect(out).toEqual(payload)
    expect(rpcSpy).toHaveBeenCalledWith('admin_dashboard')
  })

  it('throws when the RPC errors', async () => {
    rpcSpy.mockResolvedValueOnce({ data: null, error: { message: 'not authorized' } })
    await expect(loadAdminDashboard()).rejects.toThrow(/not authorized/)
  })

  it('throws when the RPC returns no data', async () => {
    rpcSpy.mockResolvedValueOnce({ data: null, error: null })
    await expect(loadAdminDashboard()).rejects.toThrow(/empty/i)
  })
})
