import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../features/storage/db'
import {
  formatDateTime,
  formatDistance,
  formatDuration,
} from '../features/stats/format'

export default function HistoryList() {
  const rides = useLiveQuery(
    () => db.rides.orderBy('startedAt').reverse().toArray(),
    [],
    [],
  )

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>
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
