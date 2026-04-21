import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import RecordScreen from './components/RecordScreen'
import HistoryList from './components/HistoryList'
import RideSummary from './components/RideSummary'
import ProfileScreen from './components/ProfileScreen'
import CommunityScreen from './components/CommunityScreen'
import AuthCallback from './components/AuthCallback'
import PrivacyScreen from './components/PrivacyScreen'
import AuthGate from './features/auth/AuthGate'

export const router = createBrowserRouter([
  { path: '/auth/callback', element: <AuthCallback /> },
  // Privacy lives OUTSIDE the AuthGate: store reviewers and the App Store /
  // Play Store listings link directly to it and must reach it without a
  // Google sign-in.
  { path: '/privacy', element: <PrivacyScreen /> },
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
      { path: 'community', element: <CommunityScreen /> },
      { path: 'profile', element: <ProfileScreen /> },
    ],
  },
])
