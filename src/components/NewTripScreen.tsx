import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createTrip, addRideToTrip } from '../features/trips/trips'
import { TRIP_COVERS, type TripCover } from '../types/trip'
import { TRIP_COVER_CLASS, TRIP_COVER_LABEL } from '../features/trips/covers'
import BackLink from './BackLink'

export default function NewTripScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const attachRideId = params.get('rideId')

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [cover, setCover] = useState<TripCover>('sunrise')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = name.trim()
  const disabled = busy || trimmedName.length === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    setBusy(true)
    setError(null)
    try {
      const trip = await createTrip({
        name: trimmedName,
        coverColor: cover,
        notes: notes || null,
      })
      if (attachRideId) {
        await addRideToTrip(attachRideId, trip.id)
      }
      navigate(`/trips/${trip.id}`, { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create trip.')
      setBusy(false)
    }
  }

  const backTarget = attachRideId ? `/ride/${attachRideId}` : '/trips'

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
      <BackLink to={backTarget} />

      <header className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
          New trip
        </span>
        <h1 className="font-display text-4xl font-bold leading-tight">
          Plan a <span className="text-gradient">tour</span>.
        </h1>
        <p className="text-sm text-neutral-400">
          Group multi-session rides into one trip. Combined stats, one shareable
          recap, full route on the map.
        </p>
      </header>

      <section
        aria-hidden
        className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4"
      >
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${TRIP_COVER_CLASS[cover]} font-display text-base font-bold text-white shadow-glow-orange`}
        >
          🛣
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-semibold tracking-tight">
            {trimmedName || 'Your trip'}
          </div>
          <div className="truncate text-xs text-neutral-500">
            {notes.trim() || 'Multi-session tour'}
          </div>
        </div>
      </section>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Trip name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="E.g. Ladakh 2026"
            maxLength={80}
            required
            className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white placeholder:text-neutral-600 transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Notes (optional)
          </span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="6-session loop · monsoon"
            maxLength={140}
            className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white placeholder:text-neutral-600 transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Cover
          </span>
          <div className="grid grid-cols-5 gap-2">
            {TRIP_COVERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCover(c)}
                aria-label={TRIP_COVER_LABEL[c]}
                aria-pressed={cover === c}
                className={[
                  'aspect-square rounded-xl bg-gradient-to-br transition-all duration-300',
                  TRIP_COVER_CLASS[c],
                  cover === c
                    ? 'ring-2 ring-white shadow-glow-orange scale-105'
                    : 'opacity-75 hover:opacity-100',
                ].join(' ')}
              />
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={disabled}
          className="rounded-2xl bg-brand-gradient py-4 font-display text-base font-bold tracking-tight text-white shadow-glow-orange transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? 'Creating…' : attachRideId ? 'Create trip + add ride' : 'Create trip'}
        </button>
      </form>
    </div>
  )
}
