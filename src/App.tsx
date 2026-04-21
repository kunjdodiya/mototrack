import { useLocation, Outlet } from 'react-router-dom'
import InstallHint from './components/InstallHint'
import BottomTabBar from './components/BottomTabBar'

export default function App() {
  const location = useLocation()
  return (
    <div className="relative flex min-h-full flex-col">
      <InstallHint />
      <main
        key={location.pathname}
        className="page-enter flex-1 pb-[calc(88px+env(safe-area-inset-bottom))]"
      >
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  )
}
