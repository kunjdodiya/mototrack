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

  const handleSeed = async () => {
    const ride = await seedDemoRide()
    navigate(`/ride/${ride.id}`)
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
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
          {rides.map((r) => (
            <li key={r.id}>
              <Link
                to={`/ride/${r.id}`}
                className="block rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition hover:border-neutral-700"
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-medium">
                    {r.name ?? formatDateTime(r.startedAt)}
                  </div>
                  <div className="text-sm text-neutral-400">
                    {r.syncedAt ? 'Synced' : 'Local'}
                  </div>
                </div>
                <div className="mt-1 text-sm text-neutral-400">
                  {formatDistance(r.stats.distanceMeters)} ·{' '}
                  {formatDuration(r.stats.durationMs)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
