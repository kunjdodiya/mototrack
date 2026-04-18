import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import RecordScreen from './components/RecordScreen'
import HistoryList from './components/HistoryList'
import RideSummary from './components/RideSummary'
import ProfileScreen from './components/ProfileScreen'
import AuthCallback from './components/AuthCallback'
import AuthGate from './features/auth/AuthGate'

export const router = createBrowserRouter([
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    path: '/',
    element: (
      <AuthGate>
        <App />
      </AuthGate>
    ),
    children: [
      { index: true, element: <RecordScreen /> },
      { path: 'history', element: <HistoryList /> },
      { path: 'ride/:id', element: <RideSummary /> },
      { path: 'profile', element: <ProfileScreen /> },
    ],
  },
])
