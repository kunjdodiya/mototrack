import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Club, ClubEvent, RsvpStatus } from '../types/club'
import { getClub } from '../features/community/clubs'
import {
  clearMyRsvp,
  deleteEvent,
  getEvent,
  getMyRsvp,
  setMyRsvp,
} from '../features/community/events'
import { getUserId } from '../features/auth/session'
import { ACCENT_GRADIENT_CLASS } from '../features/community/accents'
import BackLink from './BackLink'

type LoadState = 'loading' | 'ready' | 'not-found'

const RSVP_OPTIONS: Array<{ value: RsvpStatus; label: string }> = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'Not going' },
]

export default function EventDetailScreen() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<LoadState>('loading')
  const [event, setEvent] = useState<ClubEvent | null>(null)
  const [club, setClub] = useState<Club | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [rsvp, setRsvp] = useState<RsvpStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      try {
        const [ev, uid, mine] = await Promise.all([
          getEvent(id as string),
          getUserId(),
          getMyRsvp(id as string),
        ])
        if (cancelled) return
        if (!ev) {
          setState('not-found')
          return
        }
        setEvent(ev)
        setUserId(uid)
        setRsvp(mine)
        const c = await getClub(ev.clubId)
        if (!cancelled) {
          setClub(c)
          setState('ready')
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load event.')
          setState('ready')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  const applyRsvp = async (next: RsvpStatus) => {
    if (!event) return
    const prev = rsvp
    setBusy(true)
    setError(null)
    setRsvp(next)
    if (next === 'going' && prev !== 'going')
      setEvent({ ...event, goingCount: event.goingCount + 1 })
    if (next !== 'going' && prev === 'going')
      setEvent({ ...event, goingCount: Math.max(0, event.goingCount - 1) })
    try {
      await setMyRsvp(event.id, next)
    } catch (err: unknown) {
      setRsvp(prev)
      setError(err instanceof Error ? err.message : 'Could not save RSVP.')
    } finally {
      setBusy(false)
    }
  }

  const clearRsvp = async () => {
    if (!event || !rsvp) return
    const prev = rsvp
    setBusy(true)
    setError(null)
    setRsvp(null)
    if (prev === 'going')
      setEvent({ ...event, goingCount: Math.max(0, event.goingCount - 1) })
    try {
      await clearMyRsvp(event.id)
    } catch (err: unknown) {
      setRsvp(prev)
      setError(err instanceof Error ? err.message : 'Could not clear RSVP.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!event || !club) return
    if (!confirm(`Cancel "${event.title}"? This removes the ride for everyone.`))
      return
    setBusy(true)
    setError(null)
    try {
      await deleteEvent(event.id)
      navigate(`/community/clubs/${club.id}`, { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not cancel event.')
      setBusy(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
        <BackLink to="/community" />
        <div className="h-48 animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
        <div className="h-24 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />
      </div>
    )
  }

  if (state === 'not-found' || !event) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
        <BackLink to="/community" />
        <p className="text-neutral-400">This ride doesn't exist anymore.</p>
      </div>
    )
  }

  const isHost = userId != null && userId === event.createdBy
  const accent = club?.accent ?? 'sunrise'

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
      <BackLink to={club ? `/community/clubs/${club.id}` : '/community'} />

      <section
        className={`relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br ${ACCENT_GRADIENT_CLASS[accent]} p-6 shadow-glow-violet`}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
        <div className="relative">
          {club && (
            <span className="inline-block rounded-full bg-black/30 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
              {club.name}
            </span>
          )}
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight">
            {event.title}
          </h1>
          <p className="mt-2 text-sm text-white/90">
            {formatLongWhen(event.startAt)}
          </p>
          {event.meetLabel && (
            <p className="mt-1 text-sm text-white/80">📍 {event.meetLabel}</p>
          )}
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-white/85">
            {event.goingCount} going
          </p>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section
        role="radiogroup"
        aria-label="Your RSVP"
        className="flex flex-col gap-2"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight">
            Your RSVP
          </h2>
          {rsvp && (
            <button
              type="button"
              onClick={() => void clearRsvp()}
              disabled={busy}
              className="text-xs font-semibold uppercase tracking-wider text-neutral-500 transition hover:text-white disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {RSVP_OPTIONS.map((opt) => {
            const active = rsvp === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => void applyRsvp(opt.value)}
                disabled={busy}
                className={[
                  'rounded-2xl border px-3 py-3 text-sm font-semibold tracking-tight transition-all duration-300 active:scale-[0.98]',
                  active
                    ? 'border-transparent bg-brand-gradient text-white shadow-glow-orange'
                    : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/20',
                ].join(' ')}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </section>

      {event.description && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Notes
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-200">
            {event.description}
          </p>
        </section>
      )}

      {isHost && (
        <section className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={busy}
            className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-red-300 transition hover:border-red-500/50 hover:text-red-200 disabled:opacity-50"
          >
            Cancel ride
          </button>
        </section>
      )}
    </div>
  )
}

function formatLongWhen(startAt: number): string {
  const d = new Date(startAt)
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
