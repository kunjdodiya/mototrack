import { useEffect, useMemo, useState } from 'react'
import type { Ride } from '../types/ride'
import type { Trip } from '../types/trip'
import { listRides } from '../features/storage/rides'
import { listTrips, addRideToTrip } from '../features/trips/trips'
import {
  formatDateTime,
  formatDistance,
  formatDuration,
} from '../features/stats/format'
import { TRIP_COVER_CLASS } from '../features/trips/covers'

type Props = {
  /** The trip that selected rides will be attached to. */
  tripId: string
  /** Called when the user dismisses the sheet (background tap, Cancel, Done). */
  onClose: () => void
  /** Called after rides are successfully attached. */
  onAdded: () => void
}

/**
 * Full-screen modal listing the rider's history rides with checkboxes so they
 * can multi-select and attach several rides to a trip in one go.
 *
 * Rides already in *this* trip are hidden (they show in the Day-by-day list).
 * Rides in *another* trip render disabled with the other trip's name so the
 * rider sees why they can't select them — a ride only belongs to one trip at
 * a time, and detaching must happen on that ride's own summary screen.
 */
export default function AddRidesToTripSheet({
  tripId,
  onClose,
  onAdded,
}: Props) {
  const [rides, setRides] = useState<Ride[] | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([listRides(), listTrips()]).then(([r, t]) => {
      if (cancelled) return
      setRides(r)
      setTrips(t)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const tripNameById = useMemo(
    () => new Map(trips.map((t) => [t.id, t.name])),
    [trips],
  )

  const candidates = useMemo(
    () => (rides ?? []).filter((r) => r.tripId !== tripId),
    [rides, tripId],
  )

  const toggle = (rideId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(rideId)) next.delete(rideId)
      else next.add(rideId)
      return next
    })
  }

  const handleAdd = async () => {
    if (selected.size === 0) return
    setBusy(true)
    setError(null)
    try {
      for (const rideId of selected) {
        await addRideToTrip(rideId, tripId)
      }
      onAdded()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add rides.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add rides to trip"
      className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95 backdrop-blur-sm"
    >
      <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-300 transition hover:border-white/20 active:scale-[0.97] disabled:opacity-50"
        >
          Cancel
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Attach rides
          </span>
          <h2 className="truncate font-display text-lg font-bold tracking-tight">
            Pick from history
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={busy || selected.size === 0}
          className="rounded-full bg-brand-gradient px-4 py-1.5 text-xs font-bold text-white shadow-glow-orange transition active:scale-[0.97] disabled:opacity-40"
        >
          {busy
            ? 'Adding…'
            : selected.size > 0
              ? `Add ${selected.size} ride${selected.size === 1 ? '' : 's'}`
              : 'Add rides'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {rides == null ? (
          <div className="flex flex-col gap-3">
            <div className="h-16 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />
            <div className="h-16 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />
            <div className="h-16 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />
          </div>
        ) : candidates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-neutral-400">
            Every ride is already in this trip. Record a new ride, then come
            back to attach it here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {candidates.map((r) => {
              const otherTripName = r.tripId
                ? (tripNameById.get(r.tripId) ?? 'another trip')
                : null
              const disabled = otherTripName != null
              const checked = selected.has(r.id)
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => !disabled && toggle(r.id)}
                    disabled={disabled || busy}
                    aria-pressed={checked}
                    className={[
                      'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition',
                      checked
                        ? 'border-moto-orange/60 bg-brand-gradient-soft shadow-glow-orange'
                        : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]',
                      disabled ? 'cursor-not-allowed opacity-50' : 'active:scale-[0.99]',
                    ].join(' ')}
                  >
                    <span
                      aria-hidden
                      className={[
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition',
                        checked
                          ? 'border-white bg-white text-neutral-900'
                          : 'border-white/20 bg-white/5',
                      ].join(' ')}
                    >
                      {checked ? <CheckIcon /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-semibold tracking-tight">
                        {r.name ?? formatDateTime(r.startedAt)}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-400">
                        <span className="font-mono tabular-nums">
                          {formatDistance(r.stats.distanceMeters)}
                        </span>
                        <span className="text-neutral-600">·</span>
                        <span className="font-mono tabular-nums">
                          {formatDuration(r.stats.durationMs)}
                        </span>
                        {otherTripName && (
                          <>
                            <span className="text-neutral-600">·</span>
                            <span
                              aria-hidden
                              className={`inline-block h-2 w-2 rounded-full bg-gradient-to-br ${TRIP_COVER_CLASS.sunrise}`}
                            />
                            <span className="text-neutral-300">
                              in {otherTripName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>

      <footer className="border-t border-white/5 px-5 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 text-center text-xs text-neutral-400">
        {selected.size === 0
          ? 'Tap rides to select'
          : `${selected.size} selected`}
      </footer>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}
