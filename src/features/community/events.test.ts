import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertSpy = vi.fn()
const upsertSpy = vi.fn()
const deleteSpy = vi.fn()
const selectRows: {
  club_events: unknown[]
  event_rsvps: unknown[]
  club_members: unknown[]
  error: { message: string } | null
} = {
  club_events: [],
  event_rsvps: [],
  club_members: [],
  error: null,
}

type Chain = {
  select?: string
  eqs: Array<[string, unknown]>
  ins: Array<[string, unknown[]]>
  gte?: [string, string]
  maybeSingle?: boolean
}

vi.mock('../auth/session', () => ({
  getUserId: () => Promise.resolve('user-1'),
}))

function buildChain(table: string) {
  const chain: Chain = { eqs: [], ins: [] }
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
    gte(col: string, val: string) {
      chain.gte = [col, val]
      return result
    },
    order() {
      return result
    },
    limit() {
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
  const source =
    table === 'club_events'
      ? selectRows.club_events
      : table === 'event_rsvps'
        ? selectRows.event_rsvps
        : selectRows.club_members
  let rows = source as Array<Record<string, unknown>>
  for (const [col, val] of chain.eqs) rows = rows.filter((r) => r[col] === val)
  for (const [col, vals] of chain.ins)
    rows = rows.filter((r) => (vals as unknown[]).includes(r[col]))
  if (chain.gte) {
    const [col, val] = chain.gte
    const threshold = new Date(val).getTime()
    rows = rows.filter((r) => new Date(r[col] as string).getTime() >= threshold)
  }
  if (chain.maybeSingle) return { data: rows[0] ?? null, error: null }
  return { data: rows, error: null }
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
            deleteSpy(table, 'match', crit)
            return Promise.resolve({ error: null })
          },
          eq: (col: string, val: unknown) => {
            deleteSpy(table, 'eq', { [col]: val })
            return Promise.resolve({ error: null })
          },
        }),
      }
    },
  },
}))

function insertResult(table: string, row: Record<string, unknown>) {
  if (table === 'club_events') {
    return {
      ...row,
      going_count: 0,
      created_at: '2026-04-21T00:00:00Z',
    }
  }
  return row
}

import {
  clearMyRsvp,
  createEvent,
  deleteEvent,
  getEvent,
  getMyRsvp,
  listUpcomingEventsForClub,
  listUpcomingEventsForMyClubs,
  setMyRsvp,
} from './events'

describe('events data layer', () => {
  beforeEach(() => {
    insertSpy.mockReset()
    upsertSpy.mockReset()
    deleteSpy.mockReset()
    selectRows.club_events = []
    selectRows.event_rsvps = []
    selectRows.club_members = []
    selectRows.error = null
  })

  it('lists only upcoming events for a club and maps remote rows', async () => {
    const past = new Date(Date.now() - 86400_000).toISOString()
    const future = new Date(Date.now() + 86400_000).toISOString()
    selectRows.club_events = [
      {
        id: 'e1',
        club_id: 'c1',
        title: 'Morning loop',
        description: null,
        start_at: future,
        meet_label: "Peet's",
        meet_lat: null,
        meet_lng: null,
        created_by: 'user-1',
        going_count: 3,
        created_at: '2026-04-20T10:00:00Z',
      },
      {
        id: 'e2',
        club_id: 'c1',
        title: 'Past ride',
        description: null,
        start_at: past,
        meet_label: null,
        meet_lat: null,
        meet_lng: null,
        created_by: 'user-1',
        going_count: 0,
        created_at: '2026-04-10T10:00:00Z',
      },
    ]
    const out = await listUpcomingEventsForClub('c1')
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('e1')
    expect(out[0].title).toBe('Morning loop')
    expect(out[0].goingCount).toBe(3)
  })

  it('returns [] from listUpcomingEventsForMyClubs when no memberships', async () => {
    const out = await listUpcomingEventsForMyClubs()
    expect(out).toEqual([])
  })

  it('limits listUpcomingEventsForMyClubs to events in joined clubs', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString()
    selectRows.club_members = [
      { club_id: 'c1', user_id: 'user-1' },
      { club_id: 'c2', user_id: 'user-1' },
    ]
    selectRows.club_events = [
      {
        id: 'e1',
        club_id: 'c1',
        title: 'In',
        description: null,
        start_at: future,
        meet_label: null,
        meet_lat: null,
        meet_lng: null,
        created_by: 'user-1',
        going_count: 0,
        created_at: '2026-04-20T10:00:00Z',
      },
      {
        id: 'e2',
        club_id: 'c3',
        title: 'Out',
        description: null,
        start_at: future,
        meet_label: null,
        meet_lat: null,
        meet_lng: null,
        created_by: 'user-2',
        going_count: 0,
        created_at: '2026-04-20T10:00:00Z',
      },
    ]
    const out = await listUpcomingEventsForMyClubs()
    expect(out.map((e) => e.id)).toEqual(['e1'])
  })

  it('getEvent returns null when missing', async () => {
    const out = await getEvent('missing')
    expect(out).toBeNull()
  })

  it('creates an event with trimmed fields and ISO start_at', async () => {
    const startAt = new Date('2026-05-01T15:30:00Z').getTime()
    await createEvent({
      clubId: 'c1',
      title: '  Mulholland Loop  ',
      description: '  Sunday run  ',
      startAt,
      meetLabel: '  Cafe  ',
    })
    const [table, row] = insertSpy.mock.calls[0]
    expect(table).toBe('club_events')
    expect(row).toMatchObject({
      club_id: 'c1',
      title: 'Mulholland Loop',
      description: 'Sunday run',
      meet_label: 'Cafe',
      created_by: 'user-1',
    })
    expect(row.start_at).toBe('2026-05-01T15:30:00.000Z')
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('stores null for empty meet_label / description on create', async () => {
    await createEvent({
      clubId: 'c1',
      title: 'No frills',
      startAt: Date.now() + 3600_000,
    })
    const [, row] = insertSpy.mock.calls[0]
    expect(row.meet_label).toBeNull()
    expect(row.description).toBeNull()
    expect(row.meet_lat).toBeNull()
    expect(row.meet_lng).toBeNull()
  })

  it('deleteEvent deletes by id', async () => {
    await deleteEvent('e1')
    expect(deleteSpy).toHaveBeenCalledWith('club_events', 'eq', { id: 'e1' })
  })

  it('getMyRsvp returns the current status when a row exists', async () => {
    selectRows.event_rsvps = [
      { event_id: 'e1', user_id: 'user-1', status: 'going' },
    ]
    const out = await getMyRsvp('e1')
    expect(out).toBe('going')
  })

  it('getMyRsvp returns null when no row exists', async () => {
    const out = await getMyRsvp('e1')
    expect(out).toBeNull()
  })

  it('setMyRsvp upserts (event_id, user_id, status) for the current user', async () => {
    await setMyRsvp('e1', 'maybe')
    const [table, row] = upsertSpy.mock.calls[0]
    expect(table).toBe('event_rsvps')
    expect(row).toMatchObject({
      event_id: 'e1',
      user_id: 'user-1',
      status: 'maybe',
    })
  })

  it('clearMyRsvp deletes the current user\'s RSVP row for the event', async () => {
    await clearMyRsvp('e1')
    expect(deleteSpy).toHaveBeenCalledWith(
      'event_rsvps',
      'match',
      { event_id: 'e1', user_id: 'user-1' },
    )
  })
})
