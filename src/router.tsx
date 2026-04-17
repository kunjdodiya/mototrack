import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import RecordScreen from './components/RecordScreen'
import HistoryList from './components/HistoryList'
import RideSummary from './components/RideSummary'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <RecordScreen /> },
      { path: 'history', element: <HistoryList /> },
      { path: 'ride/:id', element: <RideSummary /> },
    ],
  },
])
