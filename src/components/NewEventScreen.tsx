import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Club } from '../types/club'
import { listMyClubs } from '../features/community/clubs'
import { createEvent } from '../features/community/events'
import BackLink from './BackLink'

function defaultStartAt(): string {
  // Next top-of-hour, seven days out.
  const d = new Date(Date.now() + 7 * 24 * 3600_000)
  d.setMinutes(0)
  d.setSeconds(0)
  d.setMilliseconds(0)
  // <input type="datetime-local"> expects "YYYY-MM-DDTHH:mm" in local time.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NewEventScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const preselectedClubId = params.get('clubId') ?? ''

  const [myClubs, setMyClubs] = useState<Club[] | null>(null)
  const [clubId, setClubId] = useState<string>(preselectedClubId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startAtLocal, setStartAtLocal] = useState<string>(defaultStartAt())
  const [meetLabel, setMeetLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listMyClubs()
      .then((clubs) => {
        if (cancelled) return
        setMyClubs(clubs)
        if (!preselectedClubId && clubs[0]) setClubId(clubs[0].id)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Could not load your clubs.')
      })
    return () => {
      cancelled = true
    }
  }, [preselectedClubId])

  const trimmedTitle = title.trim()
  const startMs = Date.parse(startAtLocal)
  const disabled =
    busy || !clubId || trimmedTitle.length === 0 || Number.isNaN(startMs)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    if (startMs < Date.now() - 60_000) {
      setError('Pick a future date and time.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const event = await createEvent({
        clubId,
        title: trimmedTitle,
        description: description || null,
        startAt: startMs,
        meetLabel: meetLabel || null,
      })
      navigate(`/community/events/${event.id}`, { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create event.')
      setBusy(false)
    }
  }

  if (myClubs !== null && myClubs.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
        <BackLink to="/community" />
        <header className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Host a ride
          </span>
          <h1 className="font-display text-4xl font-bold leading-tight">
            You need a <span className="text-gradient">club</span>.
          </h1>
          <p className="text-sm text-neutral-400">
            Rides are hosted inside a club so riders know who's coming. Start
            your own in under a minute.
          </p>
        </header>
        <a
          href="/community/clubs/new"
          className="rounded-2xl bg-brand-gradient py-4 text-center font-display text-base font-bold tracking-tight text-white shadow-glow-orange transition active:scale-[0.98]"
        >
          Start a club
        </a>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
      <BackLink to="/community" />

      <header className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
          Host a ride
        </span>
        <h1 className="font-display text-4xl font-bold leading-tight">
          New <span className="text-gradient">ride</span>.
        </h1>
        <p className="text-sm text-neutral-400">
          Your club will see it under Upcoming rides. Riders RSVP with one
          tap.
        </p>
      </header>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Club
          </span>
          <select
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
            required
            className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
          >
            <option value="" disabled>
              Select a club
            </option>
            {(myClubs ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Ride title
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mulholland morning loop"
            maxLength={80}
            required
            className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white placeholder:text-neutral-600 transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            When
          </span>
          <input
            type="datetime-local"
            value={startAtLocal}
            onChange={(e) => setStartAtLocal(e.target.value)}
            required
            className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Meet-up spot
          </span>
          <input
            type="text"
            value={meetLabel}
            onChange={(e) => setMeetLabel(e.target.value)}
            placeholder="E.g. Peet's on Skyline Blvd"
            maxLength={120}
            className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white placeholder:text-neutral-600 transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Notes (optional)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Pace, route, what to bring…"
            maxLength={500}
            rows={4}
            className="resize-none rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white placeholder:text-neutral-600 transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
          />
        </label>

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
          {busy ? 'Creating…' : 'Post the ride'}
        </button>
      </form>
    </div>
  )
}
