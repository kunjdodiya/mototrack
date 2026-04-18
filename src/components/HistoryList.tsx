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
    <div className="mx-auto max-w-xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={() => void handleSeed()}
            className="rounded-md border border-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-700"
          >
            Seed demo ride
          </button>
        )}
      </div>
      {rides.length === 0 ? (
        <p className="mt-4 text-neutral-400">
          Your rides will show up here. Nothing recorded yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rides.map((r) => {
            const bikeName = r.bikeId ? bikeNameById.get(r.bikeId) : null
            return (
              <li key={r.id}>
                <Link
                  to={`/ride/${r.id}`}
                  className="block rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition hover:border-neutral-700"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1 truncate font-semibold tracking-tight">
                      {r.name ?? formatDateTime(r.startedAt)}
                    </div>
                    <div className="text-sm text-neutral-400">
                      {r.syncedAt ? 'Synced' : 'Local'}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-neutral-400">
                    <span>{formatDistance(r.stats.distanceMeters)}</span>
                    <span>·</span>
                    <span>{formatDuration(r.stats.durationMs)}</span>
                    {bikeName && (
                      <>
                        <span>·</span>
                        <span className="text-neutral-300">🏍 {bikeName}</span>
                      </>
                    )}
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
