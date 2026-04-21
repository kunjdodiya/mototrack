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
- `scripts/generate-native-assets.mjs` — rasterises `public/icon-512.svg` into the iOS/Android/PWA icon + splash sets via `@capacitor/assets`; run with `npm run native:assets`
- `.github/workflows/deploy.yml` — auto-deploy to Cloudflare Pages on push to `main`; runs lint + tests + build + `wrangler pages deploy`
- `store/` — App Store + Play Store submission kit (listing copy, screenshot specs, account-setup walkthrough)

## Auth — Google Sign-In (required)

- `src/features/auth/supabase.ts` — Supabase client singleton; throws if env vars missing (auth is required); PKCE flow for native parity
- `src/features/auth/session.ts` — `signInWithGoogle()`, `signOut()`, `getSession()`, `onAuthChange()`; branches on `platform.isNative` to use the deep-link redirect on iOS/Android, web redirect on PWA. Exports `NATIVE_AUTH_REDIRECT` (`com.kunjdodiya.mototrack://auth/callback`)
- `src/features/auth/session.test.ts` — covers the web/native branching of `signInWithGoogle()`
- `src/features/auth/deepLink.ts` — `handleAuthDeepLink(url)` exchanges a Supabase PKCE `code` for a session and dismisses the in-app browser; `startAuthDeepLinkListener()` registers the platform's `appUrlOpen` subscription
- `src/features/auth/deepLink.test.ts` — query/fragment code extraction, error-redirect handling, browser-close on success/failure, listener forwarding
- `src/features/auth/AuthGate.tsx` — React component; renders children only when authenticated, else renders `SignInScreen`; triggers sync on first sign-in
- `src/features/auth/AuthGate.test.tsx` — renders sign-in when no session, children when session present; mocks Supabase
- `src/components/SignInScreen.tsx` — centered gradient logo + "Continue with Google" button + privacy-policy link; mesh-glow background
- `src/components/SignOutButton.tsx` — rendered inside `ProfileScreen`; calls `signOut()`
- `src/components/AuthCallback.tsx` — `/auth/callback` route; navigates home once Supabase processes the OAuth redirect

## GPS recorder

- `src/features/platform/types.ts` — `Platform` interface; typed `GeoError` with kind discriminator; native-vs-web flag (`isNative`); auth helpers (`openAuthUrl`, `closeAuthBrowser`, `onAppUrl`)
- `src/features/platform/index.ts` — runtime selection (web vs Capacitor)
- `src/features/platform/web.ts` — web implementation; watchPosition, wake lock, share; includes `checkPermissionState()`; auth helpers are no-ops / full-page navigation
- `src/features/platform/capacitor.ts` — Capacitor implementation; uses `@capacitor-community/background-geolocation` for foreground-service GPS on Android + UIBackgroundModes on iOS; `@capacitor/browser` + `@capacitor/app` for the OAuth deep-link round-trip
- `src/features/recorder/geolocation.ts` — `navigator.geolocation.watchPosition` wrapper; propagates typed PERMISSION_DENIED error
- `src/features/recorder/smoothing.ts` — `shouldAcceptPoint()`; rejects noisy/parked GPS fixes
- `src/features/recorder/smoothing.test.ts` — unit tests for accept/reject rules
- `src/features/recorder/wakeLock.ts` — web Wake Lock API wrapper
- `src/features/recorder/useRecorder.ts` — Zustand store; start/pause/resume/stop/reset
- `src/components/RecordScreen.tsx` — pre-ride form (ride name + bike dropdown sourced from Dexie `bikes` table), live stats + map during recording; shows `LocationBlockedCard` on permission denial
- `src/components/LocationBlockedCard.tsx` — shown when GPS is denied; iOS-specific instructions + retry button
- `src/components/LocationBlockedCard.test.tsx` — renders iOS copy when UA is iPhone Safari
- `src/components/LiveStats.tsx` — live distance/duration/speed readout during recording
- `src/lib/isIOSSafari.ts` — UA detection utility, shared by `LocationBlockedCard` and `useInstallPrompt`

## Stats — pure functions

- `src/features/stats/haversine.ts` — great-circle distance in meters
- `src/features/stats/haversine.test.ts` — known-distance unit tests
- `src/features/stats/computeStats.ts` — distance/duration/speed/elevation/idle/lean from a `TrackPoint[]`
- `src/features/stats/computeStats.test.ts` — fixtures for empty/single-point/multi-point tracks
- `src/features/stats/leanAngle.ts` — peak lean-angle estimate from GPS trajectory (bearing-change × speed)
- `src/features/stats/leanAngle.test.ts` — straight-line, tight-arc, and noise-rejection cases
- `src/features/stats/totals.ts` — `sumTotals()` aggregates rider-wide totals from the Dexie ride list
- `src/features/stats/totals.test.ts` — empty + multi-ride aggregation
- `src/features/stats/format.ts` — `formatDistance`, `formatDuration`, `formatSpeed`, `formatElevation`, `formatLeanAngle`, `formatDateTime`

## Storage — Dexie + Supabase

- `src/features/storage/db.ts` — Dexie v2: `rides` + `bikes` tables; v2 upgrade backfills `idleDurationMs` + `maxLeanAngleDeg` on pre-existing rides
- `src/features/storage/rides.ts` — CRUD: `saveRide`, `getRide`, `listRides`, `deleteRide`, `markSynced`
- `src/features/storage/bikes.ts` — CRUD: `listBikes`, `getBike`, `addBike`, `renameBike`, `deleteBike`, `markBikeSynced`
- `src/features/storage/sync.ts` — `pushRide`, `pushBike`, `syncUnsyncedRides()`, `pullRemoteRides()`, `pullRemoteBikes()`, `syncWithCloud()`; scoped by Google user's `auth.uid()`. `AuthGate` calls `syncWithCloud()` on sign-in so rides, bikes, and profile totals reconcile across every device signed into the same Google account.
- `src/features/storage/sync.test.ts` — unit tests for pull + two-way sync; mocks Dexie + Supabase + session
- `src/features/storage/deviceId.ts` — stable device UUID for analytics/debugging
- `src/features/storage/demoRide.ts` — dev-only seed for a synthetic ride

## History + Ride detail

- `src/components/HistoryList.tsx` — newest-first ride list; live-queried via dexie-react-hooks; shows ride name + bike chip when present
- `src/components/RideSummary.tsx` — detail view styled to match the rest of the app (uppercase overline + ride title, rounded-2xl map card with fade-up animation, ShareCard, gradient Export-PNG button, border-white Delete). Loading and not-found states reuse the same header treatment
- `src/components/RideMap.tsx` — Leaflet map wrapper
- `src/components/SpeedGraph.tsx` — SVG speed-over-distance graph; inline + poster layouts for PNG export
- `src/components/SpeedGraph.test.tsx` — placeholder + render smoke tests
- `src/features/map/leafletIcons.ts` — custom start/end markers

## Profile — per-user page

- `src/components/ProfileScreen.tsx` — gradient header with rider avatar + name + email, aggregate totals (count/distance/time/top speed/max lean), bike management (add/remove), legal-documents section, sign-out button
- `src/components/ProfileScreen.test.tsx` — render smoke test (routes + storage mocked)
- `src/components/DocumentViewer.tsx` — full-screen modal that renders PDFs in an iframe and images inline via short-lived signed URLs
- `src/features/storage/profile.ts` — `getProfileInfo(session)` (returns Google full_name/email/avatar, with user-set `custom_avatar_url` winning), `uploadAvatar(file)` (Supabase Storage `avatars` bucket, writes `user_metadata.custom_avatar_url`), `resetAvatar()` (falls back to Google picture)
- `src/features/storage/profile.test.ts` — covers metadata precedence, size/type guards, upload path scoping, and reset behaviour
- `src/features/storage/documents.ts` — `listDocuments`, `uploadDocument`, `deleteDocument`, `getDocumentViewUrl`; PDF/JPG/PNG/WebP/HEIC up to 10 MB, stored in the private `documents` Supabase Storage bucket under `<user_id>/<timestamp>__<kind>__<slug>.<ext>`
- `src/features/storage/documents.test.ts` — upload validation, list mapping, signed-URL generation, delete

## Share

- `src/features/share/exportPng.ts` — offscreen-canvas PNG compositor (1080×1620: OSM tiles + route + stats card with embedded speed graph)
- `src/features/share/projection.ts` — Web Mercator helpers for tile coordinates
- `src/features/share/share.ts` — web `sharePng()` wrapper
- `src/components/ShareCard.tsx` — DOM stats card (bike chip, speed graph, 8 stat tiles: distance, duration, moving time, idle time, avg/top speed, max lean, elev gain). Inline variant uses the shared rounded-3xl/border-white surface with rounded-2xl tiles and a "Stats" overline; poster variant keeps the 1080-wide `MotoTrack` + ride-title layout for html-to-image

## PWA

- `public/manifest.webmanifest` — PWA manifest (standalone, dark theme, maskable SVG icons)
- `public/sw.js` — hand-rolled service worker (CacheFirst for OSM tiles, NetworkFirst for navigations)
- `src/features/pwa/registerSW.ts` — registers `/sw.js` in production only
- `src/features/pwa/useInstallPrompt.ts` — PWA install prompt hook
- `src/components/InstallHint.tsx` — iOS "Add to Home Screen" hint

## Community — clubs + ride hosting (preview)

- `src/components/CommunityScreen.tsx` — two-tab screen (Clubs / Host) with an animated gradient pill indicator; Host is the default tab. Clubs panel lists featured motorcycle clubs + upcoming rides; Host panel promotes "Create a ride" with route-planner / RSVPs / meet-up-chat / event-page teasers. Data is placeholder until a `clubs` + `club_events` schema ships
- `src/components/CommunityScreen.test.tsx` — heading + tab-switch smoke test

## Routing + shell

- `src/main.tsx` — React root; mounts router; registers service worker; starts the auth deep-link listener (`startAuthDeepLinkListener()`)
- `src/router.tsx` — routes: `/`, `/history`, `/ride/:id`, `/community`, `/profile`, `/auth/callback`, `/privacy`; app routes wrapped in `<AuthGate>`; `/privacy` is intentionally outside the gate so store reviewers can read it without signing in
- `src/components/PrivacyScreen.tsx` — the public privacy policy linked from store listings + the sign-in screen
- `src/components/PrivacyScreen.test.tsx` — render smoke test
- `src/App.tsx` — layout: floating `InstallHint` toast + keyed `<Outlet />` wrapped in the `page-enter` transition + persistent `BottomTabBar`
- `src/components/BottomTabBar.tsx` — glass-blur 4-tab footer (Ride Now · My Rides · Community · My Profile) with an animated gradient pill indicator and SVG icons; respects `env(safe-area-inset-bottom)` for native notches
- `src/components/BottomTabBar.test.tsx` — renders all tabs, links to the right routes, and marks the current route as `aria-current`
- `src/index.css` — Tailwind entry + global mesh-gradient body background, `font-display` / `text-gradient` / `glass` utilities, `page-enter` transition, `prefers-reduced-motion` override
- `src/test/setup.ts` — Vitest setup; imports `@testing-library/jest-dom`
- `index.html` — loads Inter (body) + Space Grotesk (display) + JetBrains Mono (tabular figures) from Google Fonts, preconnected

## Supabase

- `supabase/schema.sql` — `public.rides` (with `name` + `bike_id`) and `public.bikes` tables; RLS scoped by `auth.uid()` on both. Idempotent — safe to re-run on existing projects.
- `supabase/storage.sql` — creates the `avatars` (public) and `documents` (private) Storage buckets and writes RLS policies that scope every object's first path segment to `auth.uid()`. Owner runs it once in the Supabase SQL editor; idempotent on re-run. Instructions are in `store/account-setup.md` §6.

## Native

- `ios/` — Xcode project (Capacitor)
- `android/` — Android Studio project (Capacitor)
- `ios/App/App/Info.plist` — privacy strings for location, `UIBackgroundModes=[location]`, `CFBundleURLTypes` for the `com.kunjdodiya.mototrack://` OAuth deep link
- `android/app/src/main/AndroidManifest.xml` — location + foreground-service-location + POST_NOTIFICATIONS permissions, plus the deep-link intent-filter on MainActivity
- `assets/` — generated 1024×1024 source PNGs that feed `@capacitor/assets`; produced by `scripts/generate-native-assets.mjs`. Output is committed under `ios/App/App/Assets.xcassets/` and `android/app/src/main/res/`
- `capacitor.config.ts` — `android.useLegacyBridge: true` is required by the background-geolocation plugin to keep updates flowing past the 5-minute mark

## Types

- `src/types/ride.ts` — `TrackPoint`, `RideStats` (includes `idleDurationMs`, `maxLeanAngleDeg`), `Ride` (optional `name`, `bikeId`)
- `src/types/bike.ts` — `Bike` (`id`, `name`, `createdAt`, `syncedAt`)
