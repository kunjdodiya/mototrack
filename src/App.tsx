import { NavLink, Outlet } from 'react-router-dom'
import InstallHint from './components/InstallHint'

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <InstallHint />
      <header className="border-b border-neutral-800 px-4 py-3">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <NavLink to="/" className="text-lg font-semibold tracking-tight">
            <span className="text-moto-orange">Moto</span>Track
          </NavLink>
          <nav className="flex gap-4 text-sm text-neutral-400">
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
          </nav>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
