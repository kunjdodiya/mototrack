import { NavLink, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

type Tab = {
  to: string
  label: string
  end?: boolean
  icon: ReactNode
}

const tabs: Tab[] = [
  { to: '/', end: true, label: 'Ride Now', icon: <RideIcon /> },
  { to: '/history', label: 'My Rides', icon: <HistoryIcon /> },
  { to: '/community', label: 'Community', icon: <CommunityIcon /> },
  { to: '/profile', label: 'My Profile', icon: <ProfileIcon /> },
]

function matchesTab(pathname: string, tab: Tab): boolean {
  if (tab.end) return pathname === tab.to
  return pathname === tab.to || pathname.startsWith(tab.to + '/')
}

export default function BottomTabBar() {
  const { pathname } = useLocation()
  const activeIndex = tabs.findIndex((t) => matchesTab(pathname, t))
  const cellPercent = 100 / tabs.length
  const pillLeft = `calc(${Math.max(activeIndex, 0) * cellPercent}% + 0.25rem)`
  const pillWidth = `calc(${cellPercent}% - 0.5rem)`

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none flex shrink-0 justify-center px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2"
    >
      <div className="glass-strong pointer-events-auto relative grid w-full max-w-xl grid-cols-4 rounded-2xl p-1 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        <span
          aria-hidden
          className={[
            'pointer-events-none absolute inset-y-1 rounded-xl bg-brand-gradient shadow-tab-active transition-all duration-500 ease-out',
            activeIndex < 0 ? 'opacity-0' : 'opacity-100',
          ].join(' ')}
          style={{ left: pillLeft, width: pillWidth }}
        />
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              [
                'relative z-10 flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold tracking-tight transition-colors duration-300 active:scale-[0.94]',
                isActive ? 'text-white' : 'text-neutral-400',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    'flex h-5 w-5 items-center justify-center transition-transform duration-500 ease-out',
                    isActive ? 'scale-110' : 'scale-100',
                  ].join(' ')}
                >
                  {tab.icon}
                </span>
                <span className="leading-none">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function RideIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <circle cx="5.5" cy="17" r="3.5" />
      <circle cx="18.5" cy="17" r="3.5" />
      <path d="M5.5 17h6l3-6h3" />
      <path d="M12 11l2-4h3" />
      <path d="M17 7l1.5 4" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 8v5l3 2" />
    </svg>
  )
}

function CommunityIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <circle cx="9" cy="9" r="3.2" />
      <circle cx="17" cy="10" r="2.6" />
      <path d="M3.5 18.5c0.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <path d="M14.5 16.5c0.8-2 2.3-3 4-3s2.8 0.8 3.5 2.5" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  )
}
