import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import RecordScreen from './components/RecordScreen'
import HistoryList from './components/HistoryList'
import RideSummary from './components/RideSummary'
import ProfileScreen from './components/ProfileScreen'
import CommunityScreen from './components/CommunityScreen'
import NewClubScreen from './components/NewClubScreen'
import ClubDetailScreen from './components/ClubDetailScreen'
import NewEventScreen from './components/NewEventScreen'
import EventDetailScreen from './components/EventDetailScreen'
import TripsList from './components/TripsList'
import NewTripScreen from './components/NewTripScreen'
import TripDetailScreen from './components/TripDetailScreen'
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
      { path: 'trips', element: <TripsList /> },
      { path: 'trips/new', element: <NewTripScreen /> },
      { path: 'trips/:id', element: <TripDetailScreen /> },
      { path: 'community', element: <CommunityScreen /> },
      { path: 'community/clubs/new', element: <NewClubScreen /> },
      { path: 'community/clubs/:id', element: <ClubDetailScreen /> },
      { path: 'community/events/new', element: <NewEventScreen /> },
      { path: 'community/events/:id', element: <EventDetailScreen /> },
      { path: 'profile', element: <ProfileScreen /> },
    ],
  },
])
