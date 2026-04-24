import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Club, ClubEvent } from '../types/club'
import { listClubs, listMyClubs } from '../features/community/clubs'
import { listUpcomingEventsForMyClubs } from '../features/community/events'
import { ACCENT_GRADIENT_CLASS, clubInitials } from '../features/community/accents'
import { getUserId } from '../features/auth/session'
import LocationPicker from './LocationPicker'
import { readStoredLocation } from '../features/community/location'

type Tab = 'clubs' | 'manager'

export default function CommunityScreen() {
  const [tab, setTab] = useState<Tab>('clubs')
  const [location, setLocation] = useState<string | null>(() =>
    readStoredLocation(),
  )
  const [discoverClubs, setDiscoverClubs] = useState<Club[] | null>(null)
  const [myClubs, setMyClubs] = useState<Club[] | null>(null)
  const [upcoming, setUpcoming] = useState<ClubEvent[] | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [mine, events, uid] = await Promise.all([
          listMyClubs(),
          listUpcomingEventsForMyClubs(),
          getUserId(),
        ])
        if (cancelled) return
        setMyClubs(mine)
        setUpcoming(events)
        setUserId(uid)
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

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const all = await listClubs({ cityLike: location })
        if (!cancelled) setDiscoverClubs(all)
      } catch (err: unknown) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Could not load clubs.')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [location])

  const myClubIds = new Set((myClubs ?? []).map((c) => c.id))
  const discover = (discoverClubs ?? []).filter((c) => !myClubIds.has(c.id))
  const managedClubs = (myClubs ?? []).filter((c) => c.createdBy === userId)
  const hostedUpcoming = (upcoming ?? []).filter((e) => e.createdBy === userId)

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
          Join motorcycle clubs near you, or manage a club and host rides for
          its members.
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
            tab === 'clubs' ? 'left-1' : 'left-[calc(50%-0.25rem)]',
          ].join(' ')}
        />
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
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'manager'}
          onClick={() => setTab('manager')}
          className={[
            'relative z-10 rounded-xl py-2.5 text-sm font-semibold tracking-tight transition-colors duration-300',
            tab === 'manager' ? 'text-white' : 'text-neutral-400',
          ].join(' ')}
        >
          Club Manager
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
          location={location}
          onLocationChange={setLocation}
          loaded={discoverClubs !== null && myClubs !== null}
        />
      ) : (
        <ManagerPanel
          managedClubs={managedClubs}
          hostedUpcoming={hostedUpcoming}
          loaded={myClubs !== null && upcoming !== null}
        />
      )}
    </div>
  )
}

function ClubsPanel({
  myClubs,
  discover,
  location,
  onLocationChange,
  loaded,
}: {
  myClubs: Club[] | null
  discover: Club[]
  location: string | null
  onLocationChange: (next: string | null) => void
  loaded: boolean
}) {
  const discoverTitle = location ? `Near ${location}` : 'Discover'
  return (
    <div className="flex animate-fade-up flex-col gap-5">
      <LocationPicker value={location} onChange={onLocationChange} />

      {myClubs && myClubs.length > 0 && (
        <section>
          <SectionHeading
            title="My clubs"
            hint={`${myClubs.length} joined`}
          />
          <ul className="mt-3 flex flex-col gap-3">
            {myClubs.map((c, i) => (
              <ClubRow key={c.id} club={c} joined index={i} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionHeading
          title={discoverTitle}
          hint={
            loaded && discover.length > 0
              ? `${discover.length} club${discover.length === 1 ? '' : 's'}`
              : undefined
          }
        />
        {!loaded ? (
          <ClubListSkeleton />
        ) : discover.length === 0 ? (
          <EmptyDiscover location={location} />
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {discover.map((c, i) => (
              <ClubRow key={c.id} club={c} index={i} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ManagerPanel({
  managedClubs,
  hostedUpcoming,
  loaded,
}: {
  managedClubs: Club[]
  hostedUpcoming: ClubEvent[]
  loaded: boolean
}) {
  const hasManagedClub = managedClubs.length > 0
  const createTarget = hasManagedClub
    ? `/community/events/new?clubId=${encodeURIComponent(managedClubs[0].id)}`
    : '/community/clubs/new'

  return (
    <div className="flex animate-fade-up flex-col gap-5">
      <section className="relative overflow-hidden rounded-2xl border border-white/5 bg-brand-gradient-soft p-5 shadow-glow-violet">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <h2 className="relative font-display text-xl font-bold tracking-tight">
          {hasManagedClub ? 'Host a ride' : 'Start your own club'}
        </h2>
        <p className="relative mt-1 max-w-sm text-sm text-white/85">
          {hasManagedClub
            ? 'Create a ride, set the meetup spot, and every member of your club can RSVP.'
            : "Club managers create rides, handle RSVPs, and run their crew's events. Start one in under a minute — you'll be its first member."}
        </p>
        <Link
          to={createTarget}
          className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition active:scale-[0.98]"
        >
          <PlusIcon />
          {hasManagedClub ? 'Create a ride' : 'Start a club'}
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <SectionHeading
            title="My clubs (managed)"
            hint={hasManagedClub ? `${managedClubs.length}` : undefined}
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
        ) : hasManagedClub ? (
          <ul className="mt-3 flex flex-col gap-3">
            {managedClubs.map((c, i) => (
              <ManagedClubRow key={c.id} club={c} index={i} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-400">
            You don't manage a club yet. Start one and you'll be able to host
            rides, post events, and track RSVPs for every member.
          </p>
        )}
      </section>

      <section>
        <SectionHeading
          title="My hosted rides"
          hint={hostedUpcoming.length > 0 ? 'Upcoming' : undefined}
        />
        {!loaded ? (
          <EventListSkeleton />
        ) : hostedUpcoming.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-400">
            No rides on the calendar yet. Create one for your members to RSVP.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {hostedUpcoming.map((ev, i) => (
              <EventRow key={ev.id} event={ev} index={i} />
            ))}
          </ul>
        )}
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
          {joined ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              Joined
            </span>
          ) : (
            <span className="rounded-full bg-brand-gradient px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-glow-orange">
              Join
            </span>
          )}
          <ChevronRight />
        </div>
      </Link>
    </li>
  )
}

function ManagedClubRow({ club, index }: { club: Club; index: number }) {
  return (
    <li
      className="animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-center gap-3">
          <Link
            to={`/community/clubs/${club.id}`}
            className="flex min-w-0 flex-1 items-center gap-3 group"
          >
            <div
              className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${ACCENT_GRADIENT_CLASS[club.accent]} text-sm font-bold font-display text-white shadow-glow-orange`}
            >
              {clubInitials(club.name)}
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
                {club.city ?? 'Motorcycle club'}
              </p>
            </div>
          </Link>
        </div>
        <Link
          to={`/community/events/new?clubId=${encodeURIComponent(club.id)}`}
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white shadow-glow-orange transition active:scale-[0.97]"
        >
          <PlusIcon />
          Host a ride
        </Link>
      </div>
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
    <ul className="mt-3 flex flex-col gap-3">
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

function EmptyDiscover({ location }: { location: string | null }) {
  return (
    <div className="mt-3 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-400">
      <span>
        {location
          ? `No clubs matched "${location}" yet. Try a broader area or start the first one.`
          : 'No clubs yet. Be the first.'}
      </span>
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
