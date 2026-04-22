import { useLocation, Outlet } from 'react-router-dom'
import InstallHint from './components/InstallHint'
import BottomTabBar from './components/BottomTabBar'

export default function App() {
  const location = useLocation()
  return (
    <div className="relative flex h-full flex-col">
      <InstallHint />
      <main
        key={location.pathname}
        className="page-enter min-h-0 flex-1 overflow-y-auto"
      >
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  )
}
