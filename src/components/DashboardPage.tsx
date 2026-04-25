import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSession, onAuthChange } from '../features/auth/session'
import { getProfileInfo, type ProfileInfo } from '../features/storage/profile'
import AdminScreen from './AdminScreen'
import SignOutButton from './SignOutButton'

/**
 * Standalone owner console at `/dashboard`. Reuses the `AdminScreen` body
 * but swaps the mobile app shell (bottom tab bar, install hint, page-enter
 * transition) for a desktop-style top nav with the rider's email and a
 * sign-out button. Bookmarkable on its own — no app chrome around it.
 */
export default function DashboardPage() {
  const [profile, setProfile] = useState<ProfileInfo>({
    name: null,
    email: null,
    avatarUrl: null,
  })

  useEffect(() => {
    void getSession().then((s) => setProfile(getProfileInfo(s)))
    return onAuthChange((s) => setProfile(getProfileInfo(s)))
  }, [])

  return (
    <div className="h-full overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-black/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold tracking-tight">
            <span className="text-gradient">Moto</span>
            <span>Track</span>
            <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Owner console
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {profile.email && (
              <span className="hidden truncate text-xs text-neutral-400 sm:inline">
                {profile.email}
              </span>
            )}
            <Link
              to="/"
              className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-neutral-300 transition hover:border-white/20 hover:text-white"
            >
              Open app
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <AdminScreen />
    </div>
  )
}
