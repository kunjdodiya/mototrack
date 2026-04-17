import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import 'leaflet/dist/leaflet.css'
import { router } from './router'
import { registerServiceWorker } from './features/pwa/registerSW'
import { ensureAnonymousSession } from './features/auth/anon'
import { syncUnsyncedRides } from './features/storage/sync'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

registerServiceWorker()

// Cloud backup runs best-effort in the background on app boot.
void ensureAnonymousSession().then(() => syncUnsyncedRides())
