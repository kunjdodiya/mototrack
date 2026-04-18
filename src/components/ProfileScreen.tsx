import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../features/storage/db'
import { addBike, deleteBike } from '../features/storage/bikes'
import { pushBike } from '../features/storage/sync'
import { sumTotals } from '../features/stats/totals'
import {
  formatDistance,
  formatDuration,
  formatLeanAngle,
  formatSpeed,
} from '../features/stats/format'
import { getSession } from '../features/auth/session'

export default function ProfileScreen() {
  const [email, setEmail] = useState<string | null>(null)
  const [newBike, setNewBike] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    void getSession().then((s) => setEmail(s?.user?.email ?? null))
  }, [])

  const rides = useLiveQuery(() => db.rides.toArray(), [], [])
  const bikes = useLiveQuery(() => db.bikes.orderBy('createdAt').toArray(), [], [])
  const totals = sumTotals(rides)

  const rideCountByBike = new Map<string, number>()
  for (const r of rides) {
    if (r.bikeId) rideCountByBike.set(r.bikeId, (rideCountByBike.get(r.bikeId) ?? 0) + 1)
  }

  const handleAddBike = async () => {
    const name = newBike.trim()
    if (!name) return
    setAdding(true)
    try {
      const bike = await addBike(name)
      setNewBike('')
      void pushBike(bike)
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteBike = async (id: string, name: string) => {
    const count = rideCountByBike.get(id) ?? 0
    const msg =
      count > 0
        ? `Remove "${name}"? ${count} ride${count === 1 ? '' : 's'} will keep their history but lose the bike label.`
        : `Remove "${name}"?`
    if (!confirm(msg)) return
    await deleteBike(id)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">My profile</h1>
        {email && (
          <p className="mt-1 text-sm text-neutral-400">{email}</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Totals
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Rides" value={String(totals.rideCount)} />
          <StatTile label="Distance" value={formatDistance(totals.totalDistanceMeters)} />
          <StatTile label="Total time" value={formatDuration(totals.totalDurationMs)} />
          <StatTile label="Moving time" value={formatDuration(totals.totalMovingDurationMs)} />
          <StatTile label="Top speed" value={formatSpeed(totals.topSpeedMps)} />
          <StatTile label="Max lean" value={formatLeanAngle(totals.maxLeanAngleDeg)} />
        </div>
        <div className="mt-3 text-right text-sm">
          <Link to="/history" className="text-moto-orange hover:underline">
            See all rides →
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          My bikes
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newBike}
            onChange={(e) => setNewBike(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAddBike()
            }}
            placeholder="e.g. KTM 390 Duke"
            maxLength={40}
            className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-base font-medium text-white placeholder:text-neutral-600 focus:border-moto-orange focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleAddBike()}
            disabled={adding || !newBike.trim()}
            className="rounded-xl bg-moto-orange px-4 py-3 font-semibold tracking-tight text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {bikes.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">
            Add your first bike and you can tag each ride with it.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {bikes.map((b) => {
              const count = rideCountByBike.get(b.id) ?? 0
              return (
                <li
                  key={b.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3"
                >
                  <div>
                    <div className="font-semibold tracking-tight">{b.name}</div>
                    <div className="text-xs text-neutral-500">
                      {count === 0 ? 'No rides yet' : `${count} ride${count === 1 ? '' : 's'}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteBike(b.id, b.name)}
                    className="text-sm text-neutral-500 hover:text-red-400"
                    aria-label={`Remove ${b.name}`}
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="text-xs font-medium uppercase tracking-widest text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
        {value}
      </div>
    </div>
  )
}
