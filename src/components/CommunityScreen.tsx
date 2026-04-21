import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Club, ClubEvent } from '../types/club'
import { listClubs, listMyClubs } from '../features/community/clubs'
import { listUpcomingEventsForMyClubs } from '../features/community/events'
import { ACCENT_GRADIENT_CLASS, clubInitials } from '../features/community/accents'

type Tab = 'clubs' | 'host'

export default function CommunityScreen() {
  const [tab, setTab] = useState<Tab>('host')
  const [allClubs, setAllClubs] = useState<Club[] | null>(null)
  const [myClubs, setMyClubs] = useState<Club[] | null>(null)
  const [upcoming, setUpcoming] = useState<ClubEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [all, mine, events] = await Promise.all([
          listClubs(),
          listMyClubs(),
          listUpcomingEventsForMyClubs(),
        ])
        if (cancelled) return
        setAllClubs(all)
        setMyClubs(mine)
        setUpcoming(events)
      } catch (err: unknown) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Could not load community.')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const myClubIds = new Set((myClubs ?? []).map((c) => c.id))
  const discover = (allClubs ?? []).filter((c) => !myClubIds.has(c.id))
  const hasAnyClub = (myClubs ?? []).length > 0

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
          Community
        </span>
        <h1 className="font-display text-4xl font-bold leading-tight">
          Find your <span className="text-gradient">crew</span>.
        </h1>
        <p className="text-sm text-neutral-400">
          Join motorcycle clubs near you or host your own rides and moto
          events.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Community sections"
        className="glass relative grid grid-cols-2 rounded-2xl p-1"
      >
        <span
          aria-hidden
          className={[
            'absolute inset-y-1 w-1/2 rounded-xl bg-brand-gradient shadow-tab-active transition-all duration-500 ease-out',
            tab === 'host' ? 'left-1' : 'left-[calc(50%-0.25rem)]',
          ].join(' ')}
        />
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'host'}
          onClick={() => setTab('host')}
          className={[
            'relative z-10 rounded-xl py-2.5 text-sm font-semibold tracking-tight transition-colors duration-300',
            tab === 'host' ? 'text-white' : 'text-neutral-400',
          ].join(' ')}
        >
          Host
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'clubs'}
          onClick={() => setTab('clubs')}
          className={[
            'relative z-10 rounded-xl py-2.5 text-sm font-semibold tracking-tight transition-colors duration-300',
            tab === 'clubs' ? 'text-white' : 'text-neutral-400',
          ].join(' ')}
        >
          Clubs
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {tab === 'clubs' ? (
        <ClubsPanel
          myClubs={myClubs}
          discover={discover}
          loaded={allClubs !== null && myClubs !== null}
        />
      ) : (
        <HostPanel
          myClubs={myClubs ?? []}
          upcoming={upcoming}
          hasAnyClub={hasAnyClub}
        />
      )}
    </div>
  )
}

function ClubsPanel({
  myClubs,
  discover,
  loaded,
}: {
  myClubs: Club[] | null
  discover: Club[]
  loaded: boolean
}) {
  return (
    <div className="flex animate-fade-up flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading
          title={myClubs && myClubs.length > 0 ? 'My clubs' : 'Clubs'}
          hint={
            myClubs && myClubs.length > 0
              ? `${myClubs.length} joined`
              : undefined
          }
        />
        <Link
          to="/community/clubs/new"
          className="inline-flex items-center gap-1 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white shadow-glow-orange transition active:scale-[0.97]"
        >
          <PlusIcon />
          New club
        </Link>
      </div>

      {!loaded ? (
        <ClubListSkeleton />
      ) : myClubs && myClubs.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {myClubs.map((c, i) => (
            <ClubRow key={c.id} club={c} joined index={i} />
          ))}
        </ul>
      ) : null}

      {loaded && (
        <section>
          <SectionHeading
            title="Discover"
            hint={discover.length > 0 ? `${discover.length} clubs` : undefined}
          />
          {discover.length === 0 ? (
            <EmptyClubs />
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {discover.map((c, i) => (
                <ClubRow key={c.id} club={c} index={i} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function HostPanel({
  myClubs,
  upcoming,
  hasAnyClub,
}: {
  myClubs: Club[]
  upcoming: ClubEvent[] | null
  hasAnyClub: boolean
}) {
  const createTarget = hasAnyClub
    ? `/community/events/new?clubId=${encodeURIComponent(myClubs[0]?.id ?? '')}`
    : '/community/clubs/new'

  return (
    <div className="flex animate-fade-up flex-col gap-5">
      <section className="relative overflow-hidden rounded-2xl border border-white/5 bg-brand-gradient-soft p-5 shadow-glow-violet">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <h2 className="relative font-display text-xl font-bold tracking-tight">
          Host a ride
        </h2>
        <p className="relative mt-1 max-w-sm text-sm text-white/85">
          {hasAnyClub
            ? 'Pick a meeting spot, set a time, and your club gets a ride they can RSVP to.'
            : "Clubs host rides. Start your own club in under a minute — you'll be its first member."}
        </p>
        <Link
          to={createTarget}
          className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition active:scale-[0.98]"
        >
          <PlusIcon />
          {hasAnyClub ? 'Create a ride' : 'Start a club'}
        </Link>
      </section>

      <section>
        <SectionHeading
          title="My upcoming rides"
          hint={upcoming && upcoming.length > 0 ? 'From your clubs' : undefined}
        />
        {upcoming === null ? (
          <EventListSkeleton />
        ) : upcoming.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-400">
            Nothing on the calendar. Host one — or join a club to see theirs.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {upcoming.map((ev, i) => (
              <EventRow key={ev.id} event={ev} index={i} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeading title="Host tools" hint="What you get" />
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {[
            { label: 'Event page', hint: 'Title · time · meet-point' },
            { label: 'RSVPs', hint: 'Going / maybe / no' },
            { label: 'Members only', hint: 'Scoped to your club' },
            { label: 'Edit + cancel', hint: 'You own your events' },
          ].map((f, i) => (
            <li
              key={f.label}
              className="animate-fade-up rounded-2xl border border-white/5 bg-white/[0.02] p-4"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="font-display text-sm font-semibold tracking-tight">
                {f.label}
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">{f.hint}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function ClubRow({
  club,
  joined,
  index,
}: {
  club: Club
  joined?: boolean
  index: number
}) {
  return (
    <li
      className="animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <Link
        to={`/community/clubs/${club.id}`}
        className="group block overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04] active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div
            className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${ACCENT_GRADIENT_CLASS[club.accent]} text-sm font-bold font-display text-white shadow-glow-orange`}
          >
            {clubInitials(club.name)}
            <span className="pointer-events-none absolute inset-0 rounded-xl bg-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="truncate font-display text-base font-semibold tracking-tight">
                {club.name}
              </h3>
              <span className="shrink-0 text-xs font-medium text-neutral-400">
                {club.memberCount} rider{club.memberCount === 1 ? '' : 's'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {[club.city, club.description].filter(Boolean).join(' · ') ||
                'Motorcycle club'}
            </p>
          </div>
          {joined && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              Joined
            </span>
          )}
          <ChevronRight />
        </div>
      </Link>
    </li>
  )
}

function EventRow({ event, index }: { event: ClubEvent; index: number }) {
  return (
    <li
      className="animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <Link
        to={`/community/events/${event.id}`}
        className="group block rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04] active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold tracking-tight">
              {event.title}
            </h3>
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {formatEventWhen(event.startAt)}
              {event.meetLabel ? ` · ${event.meetLabel}` : ''}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-brand-gradient-soft px-3 py-1 text-xs font-semibold text-white">
            {event.goingCount} going
          </span>
        </div>
      </Link>
    </li>
  )
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      {hint && (
        <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          {hint}
        </span>
      )}
    </div>
  )
}

function ClubListSkeleton() {
  return (
    <ul className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-20 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
        />
      ))}
    </ul>
  )
}

function EventListSkeleton() {
  return (
    <ul className="mt-3 flex flex-col gap-3">
      {[0, 1].map((i) => (
        <li
          key={i}
          className="h-16 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
        />
      ))}
    </ul>
  )
}

function EmptyClubs() {
  return (
    <div className="mt-3 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-400">
      <span>No clubs yet. Be the first.</span>
      <Link
        to="/community/clubs/new"
        className="rounded-full bg-brand-gradient px-3.5 py-1.5 text-xs font-semibold text-white shadow-glow-orange transition active:scale-[0.97]"
      >
        Start a club
      </Link>
    </div>
  )
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-neutral-300"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
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
