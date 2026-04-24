import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertSpy = vi.fn()
const deleteSpy = vi.fn()
const upsertSpy = vi.fn()
const selectRows: {
  clubs: unknown[]
  club_members: unknown[]
  memberRowsForUser: unknown[]
  error: { message: string } | null
} = {
  clubs: [],
  club_members: [],
  memberRowsForUser: [],
  error: null,
}

type Chain = {
  select?: string
  eqs: Array<[string, unknown]>
  ins: Array<[string, unknown[]]>
  ilikes: Array<[string, string]>
  order?: string
  limit?: number
  maybeSingle?: boolean
  gte?: [string, string]
}

vi.mock('../auth/session', () => ({
  getUserId: () => Promise.resolve('user-1'),
}))

function buildChain(table: string) {
  const chain: Chain = { eqs: [], ins: [], ilikes: [] }
  const result = {
    select(cols: string) {
      chain.select = cols
      return result
    },
    eq(col: string, val: unknown) {
      chain.eqs.push([col, val])
      return result
    },
    in(col: string, vals: unknown[]) {
      chain.ins.push([col, vals])
      return result
    },
    ilike(col: string, pattern: string) {
      chain.ilikes.push([col, pattern])
      return result
    },
    gte(col: string, val: string) {
      chain.gte = [col, val]
      return result
    },
    order() {
      return result
    },
    limit(n: number) {
      chain.limit = n
      return result
    },
    match(crit: Record<string, unknown>) {
      for (const [k, v] of Object.entries(crit)) chain.eqs.push([k, v])
      return result
    },
    maybeSingle() {
      chain.maybeSingle = true
      return Promise.resolve(resolveSelect(table, chain))
    },
    single() {
      return Promise.resolve(resolveSelect(table, chain))
    },
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve(resolveSelect(table, chain)).then(resolve)
    },
  }
  return result
}

function resolveSelect(table: string, chain: Chain) {
  if (selectRows.error) return { data: null, error: selectRows.error }
  if (table === 'clubs') {
    let rows = selectRows.clubs as Array<Record<string, unknown>>
    for (const [col, val] of chain.eqs) rows = rows.filter((r) => r[col] === val)
    for (const [col, vals] of chain.ins)
      rows = rows.filter((r) => (vals as unknown[]).includes(r[col]))
    for (const [col, pattern] of chain.ilikes) {
      const needle = pattern.replace(/^%|%$/g, '').toLowerCase()
      rows = rows.filter((r) => {
        const v = r[col]
        return typeof v === 'string' && v.toLowerCase().includes(needle)
      })
    }
    if (chain.maybeSingle) return { data: rows[0] ?? null, error: null }
    return { data: rows, error: null }
  }
  if (table === 'club_members') {
    let rows = selectRows.memberRowsForUser as Array<Record<string, unknown>>
    for (const [col, val] of chain.eqs) rows = rows.filter((r) => r[col] === val)
    if (chain.maybeSingle) return { data: rows[0] ?? null, error: null }
    return { data: rows, error: null }
  }
  return { data: [], error: null }
}

vi.mock('../auth/supabase', () => ({
  supabase: {
    from(table: string) {
      return {
        select: (cols: string) => buildChain(table).select(cols),
        insert: (row: unknown) => {
          insertSpy(table, row)
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: insertResult(table, row as Record<string, unknown>),
                  error: null,
                }),
            }),
          }
        },
        upsert: (row: unknown, opts?: unknown) => {
          upsertSpy(table, row, opts)
          return Promise.resolve({ error: null })
        },
        delete: () => ({
          match: (crit: unknown) => {
            deleteSpy(table, crit)
            return Promise.resolve({ error: null })
          },
          eq: () => {
            deleteSpy(table, 'eq')
            return Promise.resolve({ error: null })
          },
        }),
      }
    },
  },
}))

function insertResult(table: string, row: Record<string, unknown>) {
  if (table === 'clubs') {
    return {
      ...row,
      member_count: 0,
      created_at: '2026-04-21T00:00:00Z',
    }
  }
  return row
}

import {
  createClub,
  getClub,
  isMember,
  joinClub,
  leaveClub,
  listClubs,
  listMyClubs,
} from './clubs'

describe('clubs data layer', () => {
  beforeEach(() => {
    insertSpy.mockReset()
    deleteSpy.mockReset()
    upsertSpy.mockReset()
    selectRows.clubs = []
    selectRows.memberRowsForUser = []
    selectRows.error = null
  })

  it('lists all clubs and maps remote rows to domain shape', async () => {
    selectRows.clubs = [
      {
        id: 'c1',
        name: 'Twisties',
        description: null,
        city: 'Bay Area',
        accent: 'sunrise',
        created_by: 'owner-1',
        member_count: 42,
        created_at: '2026-04-20T10:00:00Z',
      },
    ]
    const out = await listClubs()
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      id: 'c1',
      name: 'Twisties',
      city: 'Bay Area',
      accent: 'sunrise',
      createdBy: 'owner-1',
      memberCount: 42,
    })
    expect(typeof out[0].createdAt).toBe('number')
  })

  it('filters listClubs by city when cityLike is provided (case-insensitive substring)', async () => {
    selectRows.clubs = [
      {
        id: 'c1',
        name: 'Bay Twisties',
        description: null,
        city: 'San Francisco, CA',
        accent: 'sunrise',
        created_by: 'u1',
        member_count: 7,
        created_at: '2026-04-20T10:00:00Z',
      },
      {
        id: 'c2',
        name: 'NYC Night Riders',
        description: null,
        city: 'New York, NY',
        accent: 'neon',
        created_by: 'u2',
        member_count: 3,
        created_at: '2026-04-19T10:00:00Z',
      },
    ]
    const out = await listClubs({ cityLike: 'san franc' })
    expect(out.map((c) => c.id)).toEqual(['c1'])
  })

  it('returns [] from listMyClubs when user has no memberships', async () => {
    selectRows.memberRowsForUser = []
    const out = await listMyClubs()
    expect(out).toEqual([])
  })

  it('returns the intersection of memberships and clubs from listMyClubs', async () => {
    selectRows.memberRowsForUser = [
      { club_id: 'c1', user_id: 'user-1' },
      { club_id: 'c2', user_id: 'user-1' },
    ]
    selectRows.clubs = [
      {
        id: 'c1',
        name: 'Twisties',
        description: null,
        city: null,
        accent: 'sunrise',
        created_by: 'owner-1',
        member_count: 3,
        created_at: '2026-04-20T10:00:00Z',
      },
      {
        id: 'c2',
        name: 'Iron Compass',
        description: null,
        city: null,
        accent: 'ocean',
        created_by: 'owner-2',
        member_count: 9,
        created_at: '2026-04-19T10:00:00Z',
      },
    ]
    const out = await listMyClubs()
    expect(out.map((c) => c.id).sort()).toEqual(['c1', 'c2'])
  })

  it('returns null from getClub when the row is missing', async () => {
    selectRows.clubs = []
    const out = await getClub('missing')
    expect(out).toBeNull()
  })

  it('creates a club with trimmed fields and the signed-in user as owner', async () => {
    const club = await createClub({
      name: '  Twisties & Tacos  ',
      description: '  Weekend canyon runs  ',
      city: 'Bay Area, CA',
      accent: 'neon',
    })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    const [table, row] = insertSpy.mock.calls[0]
    expect(table).toBe('clubs')
    expect(row).toMatchObject({
      name: 'Twisties & Tacos',
      description: 'Weekend canyon runs',
      city: 'Bay Area, CA',
      accent: 'neon',
      created_by: 'user-1',
    })
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(club.name).toBe('Twisties & Tacos')
    expect(club.memberCount).toBe(0)
  })

  it('defaults accent to sunrise and stores null for empty description/city', async () => {
    await createClub({ name: 'Solo Riders' })
    const [, row] = insertSpy.mock.calls[0]
    expect(row.accent).toBe('sunrise')
    expect(row.description).toBeNull()
    expect(row.city).toBeNull()
  })

  it('joinClub upserts (club_id, user_id) scoped to the signed-in user', async () => {
    await joinClub('c1')
    expect(upsertSpy).toHaveBeenCalledTimes(1)
    const [table, row] = upsertSpy.mock.calls[0]
    expect(table).toBe('club_members')
    expect(row).toMatchObject({ club_id: 'c1', user_id: 'user-1' })
  })

  it('leaveClub deletes the member row scoped to (club_id, user_id)', async () => {
    await leaveClub('c1')
    expect(deleteSpy).toHaveBeenCalledTimes(1)
    const [table, crit] = deleteSpy.mock.calls[0]
    expect(table).toBe('club_members')
    expect(crit).toMatchObject({ club_id: 'c1', user_id: 'user-1' })
  })

  it('isMember returns true when the member row exists', async () => {
    selectRows.memberRowsForUser = [
      { club_id: 'c1', user_id: 'user-1' },
    ]
    const out = await isMember('c1')
    expect(out).toBe(true)
  })

  it('isMember returns false when the member row is missing', async () => {
    selectRows.memberRowsForUser = []
    const out = await isMember('c1')
    expect(out).toBe(false)
  })
})
