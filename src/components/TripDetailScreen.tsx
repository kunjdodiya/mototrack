import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Trip } from '../types/trip'
import type { Ride } from '../types/ride'
import {
  deleteTrip,
  getTrip,
  listRidesForTrip,
  removeRideFromTrip,
} from '../features/trips/trips'
import { combineTripStats } from '../features/trips/combineStats'
import { TRIP_COVER_CLASS } from '../features/trips/covers'
import { renderTripSharePng } from '../features/share/exportTripPng'
import { renderTripOverlayPng } from '../features/share/exportTripOverlayPng'
import { platform } from '../features/platform'
import {
  formatDateTime,
  formatDistance,
  formatDuration,
  formatElevation,
  formatLeanAngle,
  formatSpeed,
} from '../features/stats/format'
import TripMap from './TripMap'
import BackLink from './BackLink'
import AddRidesToTripSheet from './AddRidesToTripSheet'
import ShareFormatPicker, { type ShareFormat } from './ShareFormatPicker'

type LoadState = 'loading' | 'ready' | 'not-found'

export default function TripDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [state, setState] = useState<LoadState>('loading')
  const [trip, setTrip] = useState<Trip | null>(null)
  const [rides, setRides] = useState<Ride[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [sharePicker, setSharePicker] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      const [t, r] = await Promise.all([
        getTrip(id as string),
        listRidesForTrip(id as string),
      ])
      if (cancelled) return
      if (!t) {
        setState('not-found')
        return
      }
      setTrip(t)
      setRides(r)
      setState('ready')
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  const reloadRides = async () => {
    if (!id) return
    const r = await listRidesForTrip(id)
    setRides(r)
  }

  const handleRemoveRide = async (rideId: string) => {
    if (!confirm('Remove this ride from the trip? The ride itself stays.'))
      return
    await removeRideFromTrip(rideId)
    await reloadRides()
  }

  const handleDeleteTrip = async () => {
    if (!trip) return
    if (
      !confirm(
        `Delete "${trip.name}"? Rides stay in your history but will no longer be grouped.`,
      )
    )
      return
    await deleteTrip(trip.id)
    navigate('/trips', { replace: true })
  }

  const handleShare = async (format: ShareFormat) => {
    if (!trip) return
    setSharePicker(false)
    setExporting(true)
    setExportError(null)
    try {
      const blob =
        format === 'overlay'
          ? await renderTripOverlayPng({ trip, rides })
          : await renderTripSharePng({ trip, rides })
      const suffix = format === 'overlay' ? 'overlay' : 'story'
      await platform.sharePng({
        blob,
        filename: `mototrack-trip-${suffix}-${trip.id.slice(0, 8)}.png`,
        title: `MotoTrack trip — ${trip.name}`,
        text: trip.name,
      })
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
        <BackLink to="/trips" />
        <div className="h-40 animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
        <div className="h-40 animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
      </div>
    )
  }

  if (state === 'not-found' || !trip) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
        <BackLink to="/trips" />
        <p className="text-neutral-400">This trip doesn't exist.</p>
      </div>
    )
  }

  const combined = combineTripStats(rides)
  const dateRange = formatTripDateRange(combined.startedAt, combined.endedAt)

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
      <BackLink to="/trips" />

      <section
        className={`relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br ${TRIP_COVER_CLASS[trip.coverColor]} p-6 shadow-glow-violet`}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-black/30 font-display text-2xl backdrop-blur"
          >
            🛣
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
              Multi-day trip
            </span>
            <h1 className="truncate font-display text-2xl font-bold leading-tight tracking-tight">
              {trip.name}
            </h1>
            <p className="mt-0.5 truncate text-sm text-white/85">
              {dateRange ?? 'Add rides to build your recap'}
            </p>
            {trip.notes && (
              <p className="mt-1 truncate text-xs text-white/70">{trip.notes}</p>
            )}
          </div>
        </div>
      </section>

      <div className="h-64 animate-fade-up overflow-hidden rounded-2xl border border-white/5 shadow-lg">
        {rides.length > 0 ? (
          <TripMap rides={rides} className="h-full bg-neutral-950" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">
            No rides on this trip yet
          </div>
        )}
      </div>

      <section
        className="animate-fade-up rounded-3xl border border-white/5 bg-white/[0.02] p-5"
        style={{ animationDelay: '60ms' }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
          Combined stats · {combined.dayCount} day
          {combined.dayCount === 1 ? '' : 's'}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Distance" value={formatDistance(combined.distanceMeters)} />
          <Stat label="Moving" value={formatDuration(combined.movingDurationMs)} />
          <Stat label="Idle" value={formatDuration(combined.idleDurationMs)} />
          <Stat label="Elapsed" value={formatDuration(combined.durationMs)} />
          <Stat label="Avg speed" value={formatSpeed(combined.avgSpeedMps)} />
          <Stat label="Top speed" value={formatSpeed(combined.maxSpeedMps)} />
          <Stat label="Max lean" value={formatLeanAngle(combined.maxLeanAngleDeg)} />
          <Stat
            label="Elev gain"
            value={formatElevation(combined.elevationGainMeters)}
          />
          <Stat label="Days" value={String(combined.dayCount)} />
        </div>
      </section>

      <section className="animate-fade-up" style={{ animationDelay: '120ms' }}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight">
            Session by session
          </h2>
          <div className="flex items-center gap-2">
            {rides.length > 0 && (
              <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                {rides.length} ride{rides.length === 1 ? '' : 's'}
              </span>
            )}
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="inline-flex items-center gap-1 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-bold text-white shadow-glow-orange transition active:scale-[0.97]"
            >
              <PlusIcon />
              Add rides
            </button>
          </div>
        </div>

        {rides.length === 0 ? (
          <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4">
            <p className="text-sm text-neutral-400">
              Pull rides out of your history to build this trip.
            </p>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="self-start rounded-full bg-brand-gradient px-4 py-2 text-xs font-bold text-white shadow-glow-orange transition active:scale-[0.97]"
            >
              Add rides from history
            </button>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {rides.map((r, i) => (
              <li key={r.id}>
                <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-gradient-soft text-white shadow-glow-orange">
                    <span className="font-display text-[10px] font-semibold uppercase tracking-wider">
                      Day
                    </span>
                    <span className="font-display text-lg font-bold leading-none">
                      {i + 1}
                    </span>
                  </div>
                  <Link
                    to={`/ride/${r.id}`}
                    className="min-w-0 flex-1 transition hover:opacity-80"
                  >
                    <h3 className="truncate font-display text-base font-semibold tracking-tight">
                      {r.name ?? formatDateTime(r.startedAt)}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-neutral-400">
                      {formatDistance(r.stats.distanceMeters)} ·{' '}
                      {formatDuration(r.stats.durationMs)}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleRemoveRide(r.id)}
                    aria-label={`Remove day ${i + 1} from trip`}
                    className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-300 transition hover:border-white/20 active:scale-[0.97]"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div
        className="grid animate-fade-up grid-cols-2 gap-3"
        style={{ animationDelay: '160ms' }}
      >
        <button
          type="button"
          onClick={() => setSharePicker(true)}
          disabled={exporting || rides.length === 0}
          className="rounded-2xl bg-brand-gradient py-4 text-base font-semibold text-white shadow-glow-orange transition active:scale-[0.98] disabled:opacity-40"
        >
          {exporting ? 'Generating…' : 'Share'}
        </button>
        <button
          type="button"
          onClick={() => void handleDeleteTrip()}
          className="rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-base font-semibold text-neutral-200 transition active:scale-[0.98] hover:bg-white/[0.08]"
        >
          Delete trip
        </button>
      </div>

      <p className="-mt-2 text-center text-xs text-neutral-500">
        Pick a branded Story poster or a transparent overlay with the multi-day
        route and combined distance + time.
      </p>

      {exportError && (
        <p className="text-center text-sm text-red-400">
          Export failed: {exportError}
        </p>
      )}

      {picking && (
        <AddRidesToTripSheet
          tripId={trip.id}
          onClose={() => setPicking(false)}
          onAdded={() => void reloadRides()}
        />
      )}

      {sharePicker && (
        <ShareFormatPicker
          onPick={(format) => void handleShare(format)}
          onClose={() => setSharePicker(false)}
        />
      )}
    </div>
  )
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tracking-tight tabular-nums">
        {value}
      </div>
    </div>
  )
}

function formatTripDateRange(
  start: number | null,
  end: number | null,
): string | null {
  if (start == null || end == null) return null
  const s = new Date(start)
  const e = new Date(end)
  const sameDay = s.toDateString() === e.toDateString()
  const sameYear = s.getFullYear() === e.getFullYear()
  const fmtDay = (d: Date) =>
    d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    })
  if (sameDay) return fmtDay(s)
  return `${fmtDay(s)} → ${fmtDay(e)}`
}
