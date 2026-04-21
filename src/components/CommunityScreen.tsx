import { useState } from 'react'

type Tab = 'clubs' | 'host'

const featuredClubs = [
  {
    name: 'Twisties & Tacos',
    tag: 'Weekend · Canyon runs',
    members: 214,
    city: 'Bay Area, CA',
    accent: 'from-moto-orange to-moto-magenta',
  },
  {
    name: 'Iron Compass',
    tag: 'Touring · Long-distance',
    members: 87,
    city: 'Pacific Northwest',
    accent: 'from-moto-magenta to-moto-violet',
  },
  {
    name: 'Night Apex',
    tag: 'Track · Sportbike',
    members: 41,
    city: 'Los Angeles, CA',
    accent: 'from-moto-violet to-moto-cyan',
  },
]

const upcomingEvents = [
  {
    title: 'Mulholland Morning Loop',
    host: 'Twisties & Tacos',
    when: 'Sat · 7:00 AM',
    going: 18,
  },
  {
    title: 'Sunset Ridge Meet-up',
    host: 'Iron Compass',
    when: 'Sun · 5:30 PM',
    going: 34,
  },
]

export default function CommunityScreen() {
  const [tab, setTab] = useState<Tab>('clubs')

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
          aria-selected={tab === 'host'}
          onClick={() => setTab('host')}
          className={[
            'relative z-10 rounded-xl py-2.5 text-sm font-semibold tracking-tight transition-colors duration-300',
            tab === 'host' ? 'text-white' : 'text-neutral-400',
          ].join(' ')}
        >
          Host
        </button>
      </div>

      {tab === 'clubs' ? <ClubsPanel /> : <HostPanel />}

      <PreviewNote />
    </div>
  )
}

function ClubsPanel() {
  return (
    <div className="flex animate-fade-up flex-col gap-5">
      <section>
        <SectionHeading title="Featured clubs" hint="Near you" />
        <ul className="mt-3 flex flex-col gap-3">
          {featuredClubs.map((club, i) => (
            <li
              key={club.name}
              className="animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <button
                type="button"
                className="group w-full overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04] active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${club.accent} text-sm font-bold font-display text-white shadow-glow-orange`}
                  >
                    {initials(club.name)}
                    <span className="pointer-events-none absolute inset-0 rounded-xl bg-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="truncate font-display text-base font-semibold tracking-tight">
                        {club.name}
                      </h3>
                      <span className="shrink-0 text-xs font-medium text-neutral-400">
                        {club.members} riders
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {club.tag} · {club.city}
                    </p>
                  </div>
                  <ChevronRight />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading title="Upcoming rides" hint="From clubs you follow" />
        <ul className="mt-3 flex flex-col gap-3">
          {upcomingEvents.map((ev, i) => (
            <li
              key={ev.title}
              className="animate-fade-up rounded-2xl border border-white/5 bg-white/[0.02] p-4"
              style={{ animationDelay: `${(i + 3) * 60}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-base font-semibold tracking-tight">
                    {ev.title}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    {ev.host} · {ev.when}
                  </p>
                </div>
                <span className="rounded-full bg-brand-gradient-soft px-3 py-1 text-xs font-semibold text-white">
                  {ev.going} going
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function HostPanel() {
  return (
    <div className="flex animate-fade-up flex-col gap-5">
      <section className="relative overflow-hidden rounded-2xl border border-white/5 bg-brand-gradient-soft p-5 shadow-glow-violet">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <h2 className="relative font-display text-xl font-bold tracking-tight">
          Host a ride
        </h2>
        <p className="relative mt-1 max-w-sm text-sm text-white/85">
          Plan a route, set a time, and invite riders. Track who's coming and
          chat before the kickstand goes up.
        </p>
        <button
          type="button"
          className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition active:scale-[0.98]"
        >
          <PlusIcon />
          Create a ride
        </button>
      </section>

      <section>
        <SectionHeading title="Host tools" hint="What you get" />
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {[
            { label: 'Route planner', hint: 'Pin waypoints' },
            { label: 'RSVPs', hint: 'Head-count per ride' },
            { label: 'Meet-up chat', hint: 'Rally the crew' },
            { label: 'Event page', hint: 'Shareable link' },
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

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-lg font-bold tracking-tight">
        {title}
      </h2>
      {hint && (
        <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          {hint}
        </span>
      )}
    </div>
  )
}

function PreviewNote() {
  return (
    <p className="mt-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-center text-xs text-neutral-500">
      Community is in preview. Clubs, RSVPs, and hosting launch soon.
    </p>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
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
