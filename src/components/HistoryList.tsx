import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../features/storage/db'
import { seedDemoRide } from '../features/storage/demoRide'
import {
  formatDateTime,
  formatDistance,
  formatDuration,
} from '../features/stats/format'

export default function HistoryList() {
  const navigate = useNavigate()
  const rides = useLiveQuery(
    () => db.rides.orderBy('startedAt').reverse().toArray(),
    [],
    [],
  )
  const bikes = useLiveQuery(() => db.bikes.toArray(), [], [])
  const bikeNameById = new Map(bikes.map((b) => [b.id, b.name]))

  const handleSeed = async () => {
    const ride = await seedDemoRide()
    navigate(`/ride/${ride.id}`)
  }

  return (
    <div className="mx-auto max-w-xl px-5 pb-10 pt-8">
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
            My Rides
          </span>
          <h1 className="font-display text-4xl font-bold leading-tight">
            Your <span className="text-gradient">history</span>.
          </h1>
        </div>
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={() => void handleSeed()}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-white/20"
          >
            Seed demo
          </button>
        )}
      </header>

      {rides.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rides.map((r, i) => {
            const bikeName = r.bikeId ? bikeNameById.get(r.bikeId) : null
            return (
              <li
                key={r.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <Link
                  to={`/ride/${r.id}`}
                  className="group block overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04] active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 rounded-xl bg-brand-gradient-soft shadow-glow-orange">
                      <div className="absolute inset-0.5 rounded-[10px] bg-neutral-950/70" />
                      <div className="relative flex h-full w-full items-center justify-center text-base font-display font-bold text-white">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="min-w-0 flex-1 truncate font-display text-base font-semibold tracking-tight">
                          {r.name ?? formatDateTime(r.startedAt)}
                        </h3>
                        <span
                          className={[
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                            r.syncedAt
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-white/5 text-neutral-400',
                          ].join(' ')}
                        >
                          {r.syncedAt ? 'Synced' : 'Local'}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-neutral-400">
                        <span className="font-mono tabular-nums text-neutral-200">
                          {formatDistance(r.stats.distanceMeters)}
                        </span>
                        <span className="text-neutral-600">·</span>
                        <span className="font-mono tabular-nums">
                          {formatDuration(r.stats.durationMs)}
                        </span>
                        {bikeName && (
                          <>
                            <span className="text-neutral-600">·</span>
                            <span className="text-neutral-300">🏍 {bikeName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mt-8 flex animate-fade-up flex-col items-center gap-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient-soft shadow-glow-orange">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8 text-white"
          aria-hidden
        >
          <circle cx="5.5" cy="17" r="3.5" />
          <circle cx="18.5" cy="17" r="3.5" />
          <path d="M5.5 17h6l3-6h3" />
        </svg>
      </div>
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">
          No rides yet
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          Your first ride is the one that always takes the longest to start.
        </p>
      </div>
      <Link
        to="/"
        className="rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow-orange transition active:scale-[0.98]"
      >
        Ride now
      </Link>
    </div>
  )
}
