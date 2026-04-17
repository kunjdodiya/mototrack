import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import InstallHint from './components/InstallHint'
import SignOutButton from './components/SignOutButton'
import { getSession, onAuthChange } from './features/auth/session'

export default function App() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    void getSession().then((s) => setEmail(s?.user?.email ?? null))
    return onAuthChange((s) => setEmail(s?.user?.email ?? null))
  }, [])

  return (
    <div className="flex h-full flex-col">
      <InstallHint />
      <header className="border-b border-neutral-800 px-4 py-3">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <NavLink to="/" className="text-lg font-semibold tracking-tight">
            <span className="text-moto-orange">Moto</span>Track
          </NavLink>
          <nav className="flex items-center gap-4 text-sm text-neutral-400">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? 'text-white' : 'hover:text-white'
              }
            >
              Record
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) =>
                isActive ? 'text-white' : 'hover:text-white'
              }
            >
              History
            </NavLink>
            {email && (
              <span className="hidden max-w-[10rem] truncate text-xs text-neutral-500 sm:inline">
                {email}
              </span>
            )}
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
