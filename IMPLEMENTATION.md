# IMPLEMENTATION.md

The living map of what exists in this repo and where. **Update this file every time you add, remove, or rename a feature.** Paths are validated by `npm run agents:check`.

---

## Top-level files

- `AGENTS.md` — how agents work in this repo; read first
- `DECISIONS.md` — architectural decisions log; append-only
- `IMPLEMENTATION.md` — this file; the living map
- `README.md` — user-facing setup + deploy instructions
- `package.json` — scripts + deps
- `vite.config.ts` — Vite build config (React plugin only)
- `vitest.config.ts` — Vitest config (jsdom env, setup file)
- `capacitor.config.ts` — Capacitor app id + web dir
- `tailwind.config.js`, `postcss.config.js` — Tailwind v3
- `eslint.config.js` — ESLint flat config
- `tsconfig*.json` — TypeScript strict config
- `index.html` — Vite entry HTML
- `scripts/agents-check.mjs` — canonical-docs drift validator
- `.github/workflows/deploy.yml` — auto-deploy to Cloudflare Pages on push to `main`; runs lint + tests + build + `wrangler pages deploy`

## Auth — Google Sign-In (required)

- `src/features/auth/supabase.ts` — Supabase client singleton; throws if env vars missing (auth is required)
- `src/features/auth/session.ts` — `signInWithGoogle()`, `signOut()`, `getSession()`, `onAuthChange()`
- `src/features/auth/AuthGate.tsx` — React component; renders children only when authenticated, else renders `SignInScreen`; triggers sync on first sign-in
- `src/features/auth/AuthGate.test.tsx` — renders sign-in when no session, children when session present; mocks Supabase
- `src/components/SignInScreen.tsx` — centered logo + "Continue with Google" button
- `src/components/SignOutButton.tsx` — header button; calls `signOut()`
- `src/components/AuthCallback.tsx` — `/auth/callback` route; navigates home once Supabase processes the OAuth redirect

## GPS recorder

- `src/features/platform/types.ts` — `Platform` interface; typed `GeoError` with kind discriminator
- `src/features/platform/index.ts` — runtime selection (web vs Capacitor)
- `src/features/platform/web.ts` — web implementation; watchPosition, wake lock, share; includes `checkPermissionState()`
- `src/features/platform/capacitor.ts` — Capacitor implementation
- `src/features/recorder/geolocation.ts` — `navigator.geolocation.watchPosition` wrapper; propagates typed PERMISSION_DENIED error
- `src/features/recorder/smoothing.ts` — `shouldAcceptPoint()`; rejects noisy/parked GPS fixes
- `src/features/recorder/smoothing.test.ts` — unit tests for accept/reject rules
- `src/features/recorder/wakeLock.ts` — web Wake Lock API wrapper
- `src/features/recorder/useRecorder.ts` — Zustand store; start/pause/resume/stop/reset
- `src/components/RecordScreen.tsx` — main recording UI; shows `LocationBlockedCard` on permission denial
- `src/components/LocationBlockedCard.tsx` — shown when GPS is denied; iOS-specific instructions + retry button
- `src/components/LocationBlockedCard.test.tsx` — renders iOS copy when UA is iPhone Safari
- `src/components/LiveStats.tsx` — live distance/duration/speed readout during recording
- `src/lib/isIOSSafari.ts` — UA detection utility, shared by `LocationBlockedCard` and `useInstallPrompt`

## Stats — pure functions

- `src/features/stats/haversine.ts` — great-circle distance in meters
- `src/features/stats/haversine.test.ts` — known-distance unit tests
- `src/features/stats/computeStats.ts` — distance/duration/speed/elevation from a `TrackPoint[]`
- `src/features/stats/computeStats.test.ts` — fixtures for empty/single-point/multi-point tracks
- `src/features/stats/format.ts` — `formatDistance`, `formatDuration`, `formatDateTime`

## Storage — Dexie + Supabase

- `src/features/storage/db.ts` — Dexie instance; `rides` table schema (indexes on `startedAt`, `syncedAt`)
- `src/features/storage/rides.ts` — CRUD: `saveRide`, `getRide`, `listRides`, `deleteRide`, `markSynced`
- `src/features/storage/sync.ts` — `pushRide(ride)`, `syncUnsyncedRides()`; scoped by Google user's `auth.uid()`
- `src/features/storage/deviceId.ts` — stable device UUID for analytics/debugging
- `src/features/storage/demoRide.ts` — dev-only seed for a synthetic ride

## History + Ride detail

- `src/components/HistoryList.tsx` — newest-first ride list; live-queried via dexie-react-hooks
- `src/components/RideSummary.tsx` — detail view: map + stats + PNG share
- `src/components/RideMap.tsx` — Leaflet map wrapper
- `src/features/map/leafletIcons.ts` — custom start/end markers

## Share

- `src/features/share/exportPng.ts` — offscreen-canvas PNG compositor (OSM tiles + route + stats card)
- `src/features/share/projection.ts` — Web Mercator helpers for tile coordinates
- `src/features/share/share.ts` — web `sharePng()` wrapper
- `src/components/ShareCard.tsx` — DOM stats card rendered by html-to-image

## PWA

- `public/manifest.webmanifest` — PWA manifest (standalone, dark theme, maskable SVG icons)
- `public/sw.js` — hand-rolled service worker (CacheFirst for OSM tiles, NetworkFirst for navigations)
- `src/features/pwa/registerSW.ts` — registers `/sw.js` in production only
- `src/features/pwa/useInstallPrompt.ts` — PWA install prompt hook
- `src/components/InstallHint.tsx` — iOS "Add to Home Screen" hint

## Routing + shell

- `src/main.tsx` — React root; mounts router; registers service worker
- `src/router.tsx` — routes: `/`, `/history`, `/ride/:id`, `/auth/callback`; all app routes wrapped in `<AuthGate>`
- `src/App.tsx` — layout: header (logo + nav + sign-out) + nested `<Outlet />`
- `src/index.css` — Tailwind entry + global styles
- `src/test/setup.ts` — Vitest setup; imports `@testing-library/jest-dom`

## Supabase

- `supabase/schema.sql` — `public.rides` table + RLS policies scoped by `auth.uid()`

## Native

- `ios/` — Xcode project (Capacitor)
- `android/` — Android Studio project (Capacitor)
- `ios/App/App/Info.plist` — privacy strings for location, background mode
- `android/app/src/main/AndroidManifest.xml` — location + foreground-service permissions

## Types

- `src/types/ride.ts` — `TrackPoint`, `RideStats`, `Ride`
