import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Club, ClubEvent } from '../types/club'
import {
  getClub,
  isMember,
  joinClub,
  leaveClub,
} from '../features/community/clubs'
import { listUpcomingEventsForClub } from '../features/community/events'
import { getUserId } from '../features/auth/session'
import {
  ACCENT_GRADIENT_CLASS,
  clubInitials,
} from '../features/community/accents'
import BackLink from './BackLink'

type LoadState = 'loading' | 'ready' | 'not-found'

export default function ClubDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<LoadState>('loading')
  const [club, setClub] = useState<Club | null>(null)
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [joined, setJoined] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      try {
        const [c, e, member, uid] = await Promise.all([
          getClub(id as string),
          listUpcomingEventsForClub(id as string),
          isMember(id as string),
          getUserId(),
        ])
        if (cancelled) return
        if (!c) {
          setState('not-found')
          return
        }
        setClub(c)
        setEvents(e)
        setJoined(member)
        setUserId(uid)
        setState('ready')
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load club.')
          setState('ready')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  const handleJoin = async () => {
    if (!club) return
    setBusy(true)
    setError(null)
    try {
      await joinClub(club.id)
      setJoined(true)
      setClub({ ...club, memberCount: club.memberCount + 1 })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not join.')
    } finally {
      setBusy(false)
    }
  }

  const handleLeave = async () => {
    if (!club) return
    if (!confirm(`Leave "${club.name}"?`)) return
    setBusy(true)
    setError(null)
    try {
      await leaveClub(club.id)
      setJoined(false)
      setClub({ ...club, memberCount: Math.max(0, club.memberCount - 1) })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not leave.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
        <BackLink to="/community" />
        <div className="h-40 animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
        <div className="h-20 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />
        <div className="h-20 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />
      </div>
    )
  }

  if (state === 'not-found' || !club) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
        <BackLink to="/community" />
        <p className="text-neutral-400">This club doesn't exist.</p>
      </div>
    )
  }

  const isOwner = userId != null && userId === club.createdBy

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
      <BackLink to="/community" />

      <section
        className={`relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br ${ACCENT_GRADIENT_CLASS[club.accent]} p-6 shadow-glow-violet`}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-black/30 font-display text-xl font-bold text-white backdrop-blur">
            {clubInitials(club.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold leading-tight tracking-tight">
              {club.name}
            </h1>
            <p className="mt-0.5 truncate text-sm text-white/85">
              {[club.city, club.description].filter(Boolean).join(' · ') ||
                'Motorcycle club'}
            </p>
            <p className="mt-1 text-xs text-white/70">
              {club.memberCount} rider{club.memberCount === 1 ? '' : 's'}
              {isOwner ? ' · You own this club' : ''}
            </p>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap gap-2">
          {joined ? (
            <>
              <Link
                to={`/community/events/new?clubId=${encodeURIComponent(club.id)}`}
                className="inline-flex items-center gap-1 rounded-full bg-black/30 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition active:scale-[0.97]"
              >
                <PlusIcon />
                Host a ride
              </Link>
              {!isOwner && (
                <button
                  type="button"
                  onClick={() => void handleLeave()}
                  disabled={busy}
                  className="rounded-full border border-white/20 bg-black/20 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur transition active:scale-[0.97] disabled:opacity-50"
                >
                  {busy ? 'Leaving…' : 'Leave'}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => void handleJoin()}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full bg-white px-5 py-2 text-sm font-bold text-neutral-900 transition active:scale-[0.97] disabled:opacity-50"
            >
              {busy ? 'Joining…' : 'Join club'}
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight">
            Upcoming rides
          </h2>
          {events.length > 0 && (
            <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              {events.length}
            </span>
          )}
        </div>

        {events.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-400">
            {joined
              ? 'No rides yet. Host the first one.'
              : 'No upcoming rides. Join the club to add your own.'}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {events.map((ev, i) => (
              <li
                key={ev.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <Link
                  to={`/community/events/${ev.id}`}
                  className="group block rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04] active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-semibold tracking-tight">
                        {ev.title}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {formatEventWhen(ev.startAt)}
                        {ev.meetLabel ? ` · ${ev.meetLabel}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-brand-gradient-soft px-3 py-1 text-xs font-semibold text-white">
                      {ev.goingCount} going
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
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
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function formatEventWhen(startAt: number): string {
  const d = new Date(startAt)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const withinWeek = d.getTime() - now.getTime() < 7 * 24 * 3600_000
  if (sameDay) {
    return `Today · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  }
  if (withinWeek) {
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
