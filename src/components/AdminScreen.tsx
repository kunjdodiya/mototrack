import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { checkIsAdmin, loadAdminDashboard } from '../features/admin/stats'
import type {
  AdminDashboard,
  AdminRecentUser,
  AdminSignupBucket,
  AdminTopRider,
} from '../types/admin'
import { formatDistance, formatDuration } from '../features/stats/format'

type ViewState =
  | { kind: 'loading' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: AdminDashboard }

export default function AdminScreen() {
  const [state, setState] = useState<ViewState>({ kind: 'loading' })
  const [refreshing, setRefreshing] = useState(false)

  const fetchDashboard = async (): Promise<ViewState> => {
    try {
      const admin = await checkIsAdmin()
      if (!admin) return { kind: 'forbidden' }
      const data = await loadAdminDashboard()
      return { kind: 'ready', data }
    } catch (err) {
      return {
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to load dashboard.',
      }
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    const next = await fetchDashboard()
    setState(next)
    setRefreshing(false)
  }

  useEffect(() => {
    let cancelled = false
    void fetchDashboard().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-5 pb-10 pt-8">
        <Header />
        <p className="mt-8 text-sm text-neutral-400">Loading dashboard…</p>
      </div>
    )
  }

  if (state.kind === 'forbidden') {
    return (
      <div className="mx-auto max-w-3xl px-5 pb-10 pt-8">
        <Header />
        <div className="mt-8 rounded-3xl border border-white/5 bg-white/[0.03] p-6">
          <h2 className="font-display text-xl font-bold tracking-tight">
            Not authorized
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            This page is only visible to MotoTrack owners. If you need access,
            add your email to the <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">public.admins</code> table
            in Supabase.
          </p>
          <Link
            to="/profile"
            className="mt-4 inline-block text-sm font-semibold text-gradient"
          >
            ← Back to profile
          </Link>
        </div>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-5 pb-10 pt-8">
        <Header />
        <div className="mt-8 rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
          <h2 className="font-display text-xl font-bold tracking-tight text-red-200">
            Couldn't load dashboard
          </h2>
          <p className="mt-2 break-words text-sm text-red-200/80">{state.message}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const { data } = state

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7 px-5 pb-10 pt-8">
      <Header
        generatedAt={data.generatedAt}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
      />

      <section>
        <SectionHeading title="Users" hint="All-time" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total" value={fmt(data.users.total)} accent />
          <StatTile label="New today" value={fmt(data.users.newToday)} />
          <StatTile label="Last 7 days" value={fmt(data.users.newLast7)} />
          <StatTile label="Last 30 days" value={fmt(data.users.newLast30)} />
        </div>
      </section>

      <section>
        <SectionHeading title="Active riders" hint="Recorded a ride" />
        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatTile label="DAU" value={fmt(data.activeUsers.dau)} accent />
          <StatTile label="WAU" value={fmt(data.activeUsers.wau)} />
          <StatTile label="MAU" value={fmt(data.activeUsers.mau)} />
        </div>
      </section>

      <section>
        <SectionHeading title="Rides" hint="All-time" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total rides" value={fmt(data.rides.total)} accent />
          <StatTile
            label="Total distance"
            value={formatDistance(Number(data.rides.totalDistanceMeters) || 0)}
            accent
          />
          <StatTile
            label="Moving time"
            value={formatDuration(Number(data.rides.totalMovingMs) || 0)}
          />
          <StatTile
            label="Elapsed"
            value={formatDuration(Number(data.rides.totalDurationMs) || 0)}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatTile label="Today" value={fmt(data.rides.riddenToday)} />
          <StatTile label="7 days" value={fmt(data.rides.riddenLast7)} />
          <StatTile label="30 days" value={fmt(data.rides.riddenLast30)} />
        </div>
      </section>

      <section>
        <SectionHeading title="Signups — last 30 days" />
        <SignupsChart buckets={data.signupsLast30} />
      </section>

      <section>
        <SectionHeading title="Content" hint="Across all users" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatTile label="Bikes" value={fmt(data.content.bikeCount)} />
          <StatTile label="Trips" value={fmt(data.content.tripCount)} />
          <StatTile label="Clubs" value={fmt(data.content.clubCount)} />
          <StatTile label="Events" value={fmt(data.content.eventCount)} />
          <StatTile label="RSVPs" value={fmt(data.content.rsvpCount)} />
        </div>
      </section>

      <section>
        <SectionHeading title="Top riders" hint="By total distance" />
        <TopRidersList riders={data.topRiders} />
      </section>

      <section>
        <SectionHeading title="Recent signups" hint="Most recent 20" />
        <RecentUsersList users={data.recentUsers} />
      </section>
    </div>
  )
}

function Header({
  generatedAt,
  onRefresh,
  refreshing,
}: {
  generatedAt?: number
  onRefresh?: () => void
  refreshing?: boolean
}) {
  return (
    <header className="flex items-end justify-between gap-3">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
          Owner console
        </span>
        <h1 className="font-display text-4xl font-bold leading-tight">
          <span className="text-gradient">Dashboard</span>.
        </h1>
        {generatedAt && (
          <p className="text-xs text-neutral-500">
            As of {new Date(generatedAt).toLocaleString()}
          </p>
        )}
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-200 transition hover:border-white/20 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      )}
    </header>
  )
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      {hint && (
        <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          {hint}
        </span>
      )}
    </div>
  )
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={[
        'rounded-2xl border p-4 transition',
        accent
          ? 'border-moto-orange/25 bg-gradient-to-br from-moto-orange/10 via-moto-magenta/5 to-transparent'
          : 'border-white/5 bg-white/[0.03]',
      ].join(' ')}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </div>
      <div
        className={[
          'mt-1.5 font-display text-2xl font-bold tabular-nums tracking-tight',
          accent ? 'text-gradient' : 'text-white',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  )
}

function SignupsChart({ buckets }: { buckets: AdminSignupBucket[] }) {
  if (buckets.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-400">
        No signups yet.
      </p>
    )
  }
  const max = Math.max(1, ...buckets.map((b) => Number(b.count)))
  const total = buckets.reduce((s, b) => s + Number(b.count), 0)

  return (
    <div className="mt-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
      <div className="flex h-24 items-end gap-[3px]">
        {buckets.map((b) => {
          const n = Number(b.count)
          const h = n === 0 ? 3 : Math.max(3, Math.round((n / max) * 96))
          return (
            <div
              key={b.date}
              title={`${b.date}: ${n}`}
              className={[
                'flex-1 rounded-t-sm transition',
                n > 0 ? 'bg-brand-gradient' : 'bg-white/5',
              ].join(' ')}
              style={{ height: `${h}px` }}
            />
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
        <span>{buckets[0]?.date}</span>
        <span className="text-neutral-400">{total} signups in 30 days</span>
        <span>{buckets[buckets.length - 1]?.date}</span>
      </div>
    </div>
  )
}

function TopRidersList({ riders }: { riders: AdminTopRider[] }) {
  if (riders.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-400">
        No rides recorded yet.
      </p>
    )
  }
  return (
    <ol className="mt-3 flex flex-col gap-2">
      {riders.map((r, i) => (
        <li
          key={r.userId}
          className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="w-5 text-center font-display text-sm font-bold text-neutral-500 tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="truncate font-display font-semibold tracking-tight">
                {r.name ?? r.email ?? 'Rider'}
              </div>
              <div className="truncate text-xs text-neutral-500">
                {r.email ?? '—'} · {fmt(r.rideCount)} ride{r.rideCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-base font-bold text-gradient tabular-nums">
              {formatDistance(Number(r.totalDistanceMeters) || 0)}
            </div>
            <div className="text-[11px] text-neutral-500 tabular-nums">
              {formatDuration(Number(r.totalDurationMs) || 0)}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function RecentUsersList({ users }: { users: AdminRecentUser[] }) {
  if (users.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-400">
        No users yet.
      </p>
    )
  }
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {users.map((u) => (
        <li
          key={u.userId}
          className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"
        >
          <div className="min-w-0">
            <div className="truncate font-display font-semibold tracking-tight">
              {u.name ?? u.email ?? 'Rider'}
            </div>
            <div className="truncate text-xs text-neutral-500">
              {u.email ?? '—'} · {fmt(u.rideCount)} ride{u.rideCount === 1 ? '' : 's'}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Joined
            </div>
            <div className="text-xs text-neutral-500">{shortDate(u.createdAt)}</div>
            {u.lastSignInAt && (
              <div className="mt-0.5 text-[10px] text-neutral-600">
                Last in · {shortDate(u.lastSignInAt)}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function fmt(n: number): string {
  return Number(n).toLocaleString()
}

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
