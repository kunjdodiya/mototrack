import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../features/storage/db'
import { TRIP_COVER_CLASS } from '../features/trips/covers'
import { combineTripStats } from '../features/trips/combineStats'
import { formatDistance, formatDuration } from '../features/stats/format'

export default function TripsList() {
  const trips = useLiveQuery(
    () => db.trips.orderBy('createdAt').reverse().toArray(),
    [],
    [],
  )
  const rides = useLiveQuery(() => db.rides.toArray(), [], [])

  return (
    <div className="mx-auto max-w-xl px-5 pb-10 pt-8">
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
            My Trips
          </span>
          <h1 className="font-display text-4xl font-bold leading-tight">
            Multi-session <span className="text-gradient">tours</span>.
          </h1>
        </div>
        <Link
          to="/trips/new"
          className="rounded-full bg-brand-gradient px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-glow-orange transition active:scale-[0.97]"
        >
          New trip
        </Link>
      </header>

      {trips.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {trips.map((t, i) => {
            const tripRides = rides.filter((r) => r.tripId === t.id)
            const combined = combineTripStats(tripRides)
            return (
              <li
                key={t.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <Link
                  to={`/trips/${t.id}`}
                  className="group relative block overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04] active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${TRIP_COVER_CLASS[t.coverColor]} font-display text-base font-bold text-white shadow-glow-orange`}
                    >
                      <span aria-hidden className="text-xl">🛣</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-base font-semibold tracking-tight">
                        {t.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-neutral-400">
                        <span className="font-mono tabular-nums text-neutral-200">
                          {combined.sessionCount} session{combined.sessionCount === 1 ? '' : 's'}
                        </span>
                        {combined.sessionCount > 0 && (
                          <>
                            <span className="text-neutral-600">·</span>
                            <span className="font-mono tabular-nums">
                              {formatDistance(combined.distanceMeters)}
                            </span>
                            <span className="text-neutral-600">·</span>
                            <span className="font-mono tabular-nums">
                              {formatDuration(combined.movingDurationMs)}
                            </span>
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
        <span aria-hidden className="text-3xl">🛣</span>
      </div>
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">
          No trips yet
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          Tours live here. Combine every session of a long ride into one recap.
        </p>
      </div>
      <Link
        to="/trips/new"
        className="rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow-orange transition active:scale-[0.98]"
      >
        Start a trip
      </Link>
    </div>
  )
}
