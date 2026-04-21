import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Trip } from '../types/trip'
import {
  addRideToTrip,
  listTrips,
  removeRideFromTrip,
} from '../features/trips/trips'
import { TRIP_COVER_CLASS } from '../features/trips/covers'

type Props = {
  rideId: string
  currentTripId: string | null
  onChange: () => void
}

/**
 * Inline card on the ride summary that shows either the trip this ride
 * belongs to (with an unlink affordance) or a picker of existing trips +
 * a "Create new trip" link. No modal — stays in the page flow.
 */
export default function AddToTripSheet({
  rideId,
  currentTripId,
  onChange,
}: Props) {
  const [trips, setTrips] = useState<Trip[] | null>(null)
  const [busyTripId, setBusyTripId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listTrips().then((t) => {
      if (!cancelled) setTrips(t)
    })
    return () => {
      cancelled = true
    }
  }, [currentTripId])

  const current = trips?.find((t) => t.id === currentTripId) ?? null

  const handleAttach = async (tripId: string) => {
    setBusyTripId(tripId)
    try {
      await addRideToTrip(rideId, tripId)
      onChange()
    } finally {
      setBusyTripId(null)
    }
  }

  const handleDetach = async () => {
    setBusyTripId('__detach__')
    try {
      await removeRideFromTrip(rideId)
      onChange()
    } finally {
      setBusyTripId(null)
    }
  }

  if (trips == null) {
    return (
      <div className="h-24 animate-pulse rounded-3xl border border-white/5 bg-white/[0.02]" />
    )
  }

  if (current) {
    return (
      <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
          Part of a trip
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div
            aria-hidden
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${TRIP_COVER_CLASS[current.coverColor]} text-lg shadow-glow-orange`}
          >
            🛣
          </div>
          <Link
            to={`/trips/${current.id}`}
            className="min-w-0 flex-1 transition hover:opacity-80"
          >
            <div className="truncate font-display text-base font-semibold tracking-tight">
              {current.name}
            </div>
            <div className="text-xs text-neutral-500">
              Tap to view combined stats
            </div>
          </Link>
          <button
            type="button"
            onClick={() => void handleDetach()}
            disabled={busyTripId === '__detach__'}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-300 transition hover:border-white/20 active:scale-[0.97] disabled:opacity-50"
          >
            {busyTripId === '__detach__' ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
          Add to a trip
        </div>
        <Link
          to={`/trips/new?rideId=${encodeURIComponent(rideId)}`}
          className="text-xs font-semibold text-gradient transition hover:opacity-80"
        >
          New trip →
        </Link>
      </div>

      {trips.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">
          No trips yet. Create one to group multi-day rides into a single recap.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {trips.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => void handleAttach(t.id)}
                disabled={busyTripId !== null}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-left transition hover:border-white/10 hover:bg-white/[0.04] active:scale-[0.99] disabled:opacity-50"
              >
                <div
                  aria-hidden
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${TRIP_COVER_CLASS[t.coverColor]} text-base shadow-glow-orange`}
                >
                  🛣
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-sm font-semibold tracking-tight">
                    {t.name}
                  </div>
                  {t.notes && (
                    <div className="truncate text-xs text-neutral-500">
                      {t.notes}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-xs font-semibold text-neutral-400">
                  {busyTripId === t.id ? 'Adding…' : 'Add'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
