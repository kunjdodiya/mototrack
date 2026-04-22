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
- `src/features/auth/AuthGate.tsx` — React component; renders children only when authenticated, else renders `SignInScreen`; calls `syncWithCloud()` on first sign-in AND starts `liveSync` so every foreground/focus/resume/tick repulls remote rows across devices (unsubscribed on sign-out)
- `src/features/auth/AuthGate.test.tsx` — renders sign-in when no session, children when session present; mocks Supabase
- `src/components/SignInScreen.tsx` — centered gradient logo + "Continue with Google" button + privacy-policy link; mesh-glow background
- `src/components/SignOutButton.tsx` — rendered inside `ProfileScreen`; calls `signOut()`
- `src/components/AuthCallback.tsx` — `/auth/callback` route; navigates home once Supabase processes the OAuth redirect

## GPS recorder

- `src/features/platform/types.ts` — `Platform` interface; typed `GeoError` with kind discriminator; native-vs-web flag (`isNative`); auth helpers (`openAuthUrl`, `closeAuthBrowser`, `onAppUrl`); `hapticTap(style)` where style is `'light' | 'medium' | 'heavy'`; `onAppResume(handler)` — native-only foreground hook used by `liveSync` (web is a no-op, covered by `document.visibilitychange` + `window.focus`)
- `src/features/platform/index.ts` — runtime selection (web vs Capacitor)
- `src/features/platform/web.ts` — web implementation; watchPosition, wake lock, share; includes `checkPermissionState()`; auth helpers are no-ops / full-page navigation; `hapticTap` maps styles onto the Vibration API, silent on iOS Safari
- `src/features/platform/web.test.ts` — covers the `hapticTap` light/heavy mapping, silent no-op when `navigator.vibrate` is absent, and swallowing a thrown vibrate
- `src/features/platform/capacitor.ts` — Capacitor implementation; uses `@capacitor-community/background-geolocation` for foreground-service GPS on Android + UIBackgroundModes on iOS; `@capacitor/browser` + `@capacitor/app` for the OAuth deep-link round-trip + `onAppResume` (`appStateChange` filtered to `isActive: true`) so `liveSync` can repull on foreground; `@capacitor/haptics` for Taptic Engine / vibrator pulses via `hapticTap`
- `src/features/recorder/geolocation.ts` — `navigator.geolocation.watchPosition` wrapper; propagates typed PERMISSION_DENIED error
- `src/features/recorder/smoothing.ts` — `shouldAcceptPoint()`; rejects noisy/parked GPS fixes
- `src/features/recorder/smoothing.test.ts` — unit tests for accept/reject rules
- `src/features/recorder/wakeLock.ts` — web Wake Lock API wrapper
- `src/features/recorder/useRecorder.ts` — Zustand store; start/pause/resume/stop/stopAt/reset. `stopAt(endedAt)` is the "forgot to stop" path — truncates `points` where `ts <= endedAt`, recomputes stats with that cutoff, and saves the ride as if the rider had stopped at that moment. The cutoff is clamped to `[startedAt, now]` so a nonsense value can never produce a negative-duration ride
- `src/features/recorder/useRecorder.test.ts` — covers `stopAt` idle-guard, trim + recompute happy-path, and the pre-start clamp
- `src/features/recorder/sound.ts` — `playStartChime()` / `playPauseChime()` / `playResumeChime()` / `playStopChime()`; synthesized Web Audio chimes fired from the recorder button handlers so each state change gets a distinct audible confirmation. Silent when AudioContext is unavailable
- `src/features/recorder/sound.test.ts` — no-op-when-unavailable + oscillator-count per chime on a fake AudioContext (module is reset between tests so the cached singleton doesn't leak)
- `src/components/RecordScreen.tsx` — pre-ride form (ride name + bike dropdown sourced from Dexie `bikes` table), live stats + map during recording; shows `LocationBlockedCard` on permission denial. On the idle screen, when the Dexie `rides` count is 0, a "First ride?" walkthrough card explains what the app will give the user (live stats, detailed summary, shareable story card) so first-time users understand the payoff before tapping Start; the card disappears automatically after the first recorded ride. Below the bike picker the idle screen shows a live preview `RideMap` centred on the rider's current position — gated on `platform.checkLocationPermission() === 'granted'` so the preview never triggers a permission prompt before the rider commits to starting; if permission isn't granted yet the map falls back to its default centre. Below the preview map the Start affordance is a `SwipeToStartButton` pill (swipe past 85% to commit) — confirmed swipes call the same `handleStart` as the old tap Start button. The live view enters with an `animate-launch` wrapper + one-shot `animate-launch-burst` gradient flare (defined in `tailwind.config.js`) so the transition out of the idle screen reads as deliberate rather than abrupt. The live map sits inside a 2px `bg-brand-gradient bg-[length:200%_200%]` frame: while recording the gradient glides via `animate-gradient-shift` and carries `shadow-glow-orange`; while paused the frame drops to `opacity-60` and the animation stops, signalling "we're here but not capturing". Start/pause/resume/stop each fire a distinct chime + `platform.hapticTap(...)` buzz for tactile feedback on devices that support it
- `src/components/SwipeToStartButton.tsx` — pointer-driven swipe-to-confirm pill used on the idle `RecordScreen`. A white knob sits at the left of a track; dragging it past 85% of the track width fires `onConfirm` exactly once (guarded via a ref so overshoot drags don't double-fire). Uses `setPointerCapture` so the swipe keeps tracking after the finger leaves the pill. Releases before the threshold spring the knob back to zero. Silent shimmer sweep invites the user to swipe when idle; dimmed to 40% opacity when `disabled`
- `src/components/SwipeToStartButton.test.tsx` — covers the happy-path fire, release-before-threshold no-op, disabled-ignores-input, and fire-only-once-per-swipe
- `src/components/RecordScreen.test.tsx` — locks the live gradient-frame behaviour: mocks `RideMap`/dexie/platform and drives `useRecorder.setState` so the assertion reads straight off the rendered class list (recording → animated + glow; paused → dimmed, no animation)
- `src/components/LocationBlockedCard.tsx` — shown when GPS is denied; iOS-specific instructions + retry button
- `src/components/LocationBlockedCard.test.tsx` — renders iOS copy when UA is iPhone Safari
- `src/components/LiveStats.tsx` — live distance/duration/speed readout during recording
- `src/components/ForgotToStopSheet.tsx` — shared bottom-sheet used by both the live record screen ("Forgot to stop? Trim ride") and the ride recap ("Trim this ride"). Preset chips (15 min · 30 min · 1-8 hr ago) plus a custom hours input; presets that exceed the ride duration are disabled; preview pane shows the new end timestamp plus Kept vs Dropped (distance + duration) so the rider can see exactly what they're saving before confirming. Copy is parameterised via `eyebrow` / `title` / `description` / `confirmLabel` props; anchoring is parameterised via `endReference` (defaults to `Date.now()` for the live path, set to `ride.endedAt` for the recap path so presets mean "N hr before the original end"). `onConfirm(cutoff)` is wired to `useRecorder.stopAt` on the live view and to `trimRide` + `pushRide` on the recap view
- `src/components/ForgotToStopSheet.test.tsx` — presets + custom input render, presets past the ride duration are disabled, confirm fires with the right cutoff on both the live (`endReference = Date.now()`) and recap (`endReference = ride.endedAt`) paths, Cancel fires `onClose`
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

- `src/features/storage/db.ts` — Dexie v3: `rides` + `bikes` + `trips` tables. v2 added `bikes` + backfills `idleDurationMs` / `maxLeanAngleDeg` on pre-existing rides; v3 adds the `trips` table and a `tripId` index on `rides` so `where('tripId').equals(id)` is cheap
- `src/features/storage/rides.ts` — CRUD: `saveRide`, `getRide`, `listRides`, `deleteRide`, `markSynced`, `trimRide`. `trimRide(id, newEndedAt)` retroactively shortens a saved ride: truncates track by `ts`, recomputes stats, clears `syncedAt` so the next sync re-pushes (upsert by id overwrites the Supabase row). The cutoff is clamped to `[startedAt, original endedAt]` so a silly value can never extend a ride or produce a negative duration
- `src/features/storage/rides.test.ts` — covers `trimRide` missing-id, happy-path trim + stats recompute, and both clamp edges
- `src/features/storage/bikes.ts` — CRUD: `listBikes`, `getBike`, `addBike`, `renameBike`, `deleteBike`, `markBikeSynced`
- `src/features/storage/sync.ts` — `pushRide`, `pushBike`, `pushTrip`, `syncUnsyncedRides()`, `pullRemoteRides()`, `pullRemoteBikes()`, `pullRemoteTrips()`, `pullFromCloud()`, `syncWithCloud()`; scoped by Google user's `auth.uid()`. `AuthGate` calls `syncWithCloud()` on sign-in so rides, bikes, trips, and profile totals reconcile across every device signed into the same Google account. Trips are pushed before rides so a ride carrying a new `trip_id` references an already-persisted parent row. `pullFromCloud()` is the pull-only counterpart used by the live-sync loop on foregrounding.
- `src/features/storage/sync.test.ts` — unit tests for pull + two-way sync; mocks Dexie + Supabase + session
- `src/features/storage/liveSync.ts` — `startLiveSync()` keeps Dexie in step with Supabase after sign-in by running `syncUnsyncedRides()` + `pullFromCloud()` whenever the tab becomes visible, the window gains focus, the native app resumes from the background, or a 90s foreground interval fires. Returns an unsubscribe fn that `AuthGate` calls on sign-out. Skips overlapping pulls while one is already in flight.
- `src/features/storage/liveSync.test.ts` — covers visibility, focus, native-resume, interval, teardown, and the in-flight guard under fake timers
- `src/features/storage/deviceId.ts` — stable device UUID for analytics/debugging
- `src/features/storage/demoRide.ts` — dev-only seed for a synthetic ride

## History + Ride detail

- `src/components/HistoryList.tsx` — newest-first ride list; live-queried via dexie-react-hooks; shows ride name + bike chip + trip badge when present. Top of the screen renders a Trips strip (live-queried `trips` table) with `All trips` / `New` links and a horizontal chip row of the user's trips
- `src/components/RideSummary.tsx` — detail view styled to match the rest of the app (uppercase overline + ride title, rounded-2xl map card with fade-up animation, ShareCard, `AddToTripSheet` for attach/detach, gradient "Share to Story" button that triggers the 1080×1920 PNG compositor + native share sheet, border-white Delete, and a subtle "Forgot to stop? Trim ride →" link that opens `ForgotToStopSheet` anchored on `ride.endedAt`; confirm calls `trimRide(id, cutoff)` + fire-and-forget `pushRide` to re-upsert the shortened row in Supabase). Loading and not-found states reuse the same header treatment
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

- `src/features/share/exportPng.ts` — pure-canvas compositor that renders a 1080×1920 Instagram-Story PNG: multiply-tinted CARTO Dark Matter map hero with route halo, brand-gradient wash (orange → magenta → violet), MotoTrack logo + wordmark drawn via `drawLogoTile` + `drawLogoMark` (shared with `exportTripPng.ts`), ride title in brand gradient, optional bike chip, two hero stat tiles (Distance + Top Speed) with gradient-filled values, and a 3×2 grid of the remaining stats. Awaits `document.fonts.ready` so Space Grotesk / Inter paint correctly. No DOM rasterisation — everything goes through `CanvasRenderingContext2D`
- `src/features/share/exportPng.test.ts` — stubs `fetch` + `createImageBitmap` + `canvas.toBlob` under jsdom; asserts the short-ride guard throws and that the compositor produces an 1080×1920 PNG blob
- `src/features/share/logoMark.ts` — canvas helpers `drawLogoTile` (ink base + orange/violet ambient glows) and `drawLogoMark` (gradient-stroked M waveform + white-core pink apex pin); must stay visually aligned with `public/icon-512.svg`
- `src/features/share/projection.ts` — Web Mercator helpers for tile coordinates
- `src/features/share/share.ts` — web `sharePng()` wrapper (Web Share API with files on iOS 15+/Android Chrome 89+, download fallback). On mobile the share sheet exposes "Add to Instagram Story" / "WhatsApp Status" / etc. directly — no platform-specific code needed
- `src/components/ShareCard.tsx` — inline stats card shown on the ride summary screen (bike chip, speed graph, 8 stat tiles: distance, duration, moving time, idle time, avg/top speed, max lean, elev gain). Rounded-3xl surface with rounded-2xl tiles and a "Stats" overline. The shareable PNG is composed separately in `exportPng.ts` — ShareCard is now a pure UI surface, not a rasterisation target
- `src/features/share/exportOverlayPng.ts` — 1080×1920 *transparent* PNG compositor for a single ride: route line (white halo + orange core), minimal speed graph, and two big numbers (DISTANCE + TIME) with drop shadows so white text stays legible on any photo underneath. Every non-stroke, non-text pixel stays fully transparent so the PNG can sit on top of a rider's own photo
- `src/features/share/exportOverlayPng.test.ts` — throws on a single-point ride + emits a 1080×1920 PNG; stubs fetch/createImageBitmap/toBlob under jsdom
- `src/components/ShareFormatPicker.tsx` — bottom-sheet modal that appears when a rider taps Share. Two tap targets: "Story poster" (existing 1080×1920 brand poster) and "Transparent overlay". Emits `onPick('poster' \| 'overlay')` so the caller runs the right compositor
- `src/components/ShareFormatPicker.test.tsx` — renders both choices + Cancel, and verifies each click wires to the right callback

## PWA

- `public/manifest.webmanifest` — PWA manifest (standalone, dark theme, maskable SVG icons)
- `public/sw.js` — hand-rolled service worker (CacheFirst for CARTO dark tiles, NetworkFirst for navigations)
- `src/features/pwa/registerSW.ts` — registers `/sw.js` in production only
- `src/features/pwa/useInstallPrompt.ts` — PWA install prompt hook
- `src/components/InstallHint.tsx` — iOS "Add to Home Screen" hint

## Community — clubs + ride hosting

- `src/components/CommunityScreen.tsx` — two-tab screen (Clubs / Host) with an animated gradient pill indicator; Host is the default tab. Clubs panel shows "My clubs" + "Discover" from `listClubs()` / `listMyClubs()` with a live "New club" CTA. Host panel promotes "Create a ride" (routes to `/community/events/new?clubId=…` when the user is in a club, `/community/clubs/new` otherwise), lists the user's upcoming RSVPed rides from `listUpcomingEventsForMyClubs()`, and keeps a static Host-tools grid
- `src/components/CommunityScreen.test.tsx` — header, default-tab, tab-switch, My-clubs-vs-Discover split, and Host-CTA deep-link (contains `clubId=…`)
- `src/components/NewClubScreen.tsx` — club creation form: name (required), city, one-line vibe, 5-color accent picker (sunrise · neon · ocean · aurora · ember) with live preview tile; submits via `createClub()` and navigates to the new club's detail page
- `src/components/NewClubScreen.test.tsx` — submit happy-path + blank-name disables submit
- `src/components/ClubDetailScreen.tsx` — gradient club header tinted by `accent`, member count + owner badge, Join / Leave / "Host a ride" actions, upcoming-rides list from `listUpcomingEventsForClub()`. Loads via `getClub` + `isMember` + `getUserId` in parallel
- `src/components/ClubDetailScreen.test.tsx` — not-found state, Join button for non-members, Leave + Host-a-ride for members, owner hides Leave, Join click calls `joinClub`
- `src/components/NewEventScreen.tsx` — ride hosting form: club picker (pre-selected via `?clubId=`), title (required), datetime-local starting one week out, meet-label, notes. Redirects to `/community/clubs/new` when the user isn't in any club. `startAt < now - 60s` rejected on submit rather than in render (keeps the disabled calc pure for the React 19 hooks-purity rule)
- `src/components/EventDetailScreen.tsx` — gradient event header (accent sourced from the parent club), formatted long date, meet-point chip, 3-way RSVP radiogroup (Going / Maybe / Not going) with optimistic count updates + error rollback, Clear button, host-only Cancel ride
- `src/components/EventDetailScreen.test.tsx` — not-found, title + going + radio options render, optimistic Going bump + `setMyRsvp`, Cancel ride visible to host only
- `src/components/BackLink.tsx` — reusable glass-pill back link used by the three community detail/create screens
- `src/features/community/clubs.ts` — `listClubs()`, `listMyClubs()`, `getClub(id)`, `createClub({ name, description?, city?, accent? })`, `joinClub(id)`, `leaveClub(id)`, `isMember(id)`. Remote `public.clubs` columns selected as a single `CLUB_COLUMNS` constant, mapped to the domain `Club` type with `createdAt` as epoch ms
- `src/features/community/clubs.test.ts` — list + myClubs + getClub (null path) + create (trim + default accent + null empties) + join/leave scoped to `(club_id, user_id)` + isMember truthiness
- `src/features/community/events.ts` — `listUpcomingEventsForClub(clubId)`, `listUpcomingEventsForMyClubs(limit=10)`, `getEvent(id)`, `createEvent({…})`, `deleteEvent(id)`, `getMyRsvp(eventId)`, `setMyRsvp(eventId, status)`, `clearMyRsvp(eventId)`. All server filters use `start_at >= now()` so the app never sees past rides in upcoming lists
- `src/features/community/events.test.ts` — upcoming filter, my-clubs-only filter, getEvent null path, create trim + ISO conversion + null empties, deleteEvent by id, RSVP upsert + clear
- `src/features/community/accents.ts` — `ACCENT_GRADIENT_CLASS` (maps each accent to a Tailwind `from-…/via-…/to-…` triple), `ACCENT_LABEL` for a11y, `clubInitials(name)` helper
- `src/types/club.ts` — `Club`, `ClubMembership`, `ClubEvent`, `RsvpStatus` ('going'|'maybe'|'no'), `EventRsvp`, `ClubAccent` ('sunrise'|'neon'|'ocean'|'aurora'|'ember') + `CLUB_ACCENTS` array for the picker
- `supabase/community.sql` — creates `public.clubs`, `public.club_members`, `public.club_events`, `public.event_rsvps` with RLS. Trigger-maintained `clubs.member_count` and `club_events.going_count` keep roster counts visible without exposing the member roster. An auto-join trigger on `clubs` makes the creator the first member so the "only members can create events" policy works immediately. Idempotent — safe to re-run. Owner executes it once; instructions in `store/account-setup.md` §7

## Trips — multi-session tours

- `src/types/trip.ts` — `Trip` (`id`, `name`, `coverColor`, `notes`, `createdAt`, `syncedAt`), `TripCover` ('sunrise'|'neon'|'ocean'|'aurora'|'ember') + `TRIP_COVERS` array for the picker
- `src/features/trips/trips.ts` — local-first CRUD: `listTrips`, `getTrip`, `createTrip`, `updateTrip`, `deleteTrip`, `markTripSynced`, `listRidesForTrip`, `addRideToTrip`, `removeRideFromTrip`. Uses the Dexie `tripId` index so listing a trip's rides is O(matches), not a full scan. `deleteTrip` first detaches every attached ride so a removed trip never leaves dangling refs
- `src/features/trips/trips.test.ts` — create/update/delete/list with defaults, trimming, syncedAt invalidation, attach/detach, and cascade detach on trip delete
- `src/features/trips/covers.ts` — `TRIP_COVER_CLASS` (Tailwind `from-…/via-…/to-…` per cover), `TRIP_COVER_LABEL` for a11y, `TRIP_COVER_HEX` for the canvas share compositor
- `src/features/trips/combineStats.ts` — `combineTripStats(rides)` → sums distance/duration/moving/idle/elevation, takes max of top speed + lean, derives trip-wide avg speed from totals, spans `startedAt`/`endedAt` across the full range
- `src/features/trips/combineStats.test.ts` — empty trip, sums + maxes, derived avg, span, null-elevation when no ride reports any
- `src/components/TripsList.tsx` — `/trips` screen; live-queried trip cards with combined session count + distance + moving time
- `src/components/TripsList.test.tsx` — renders heading, new-trip CTA, per-trip cards with combined stats; mocks Dexie + `useLiveQuery`
- `src/components/NewTripScreen.tsx` — `/trips/new` screen; name + notes + 5-color cover picker. When invoked with `?rideId=…`, also calls `addRideToTrip` so a rider can create a trip and attach the current ride in one submit
- `src/components/NewTripScreen.test.tsx` — disabled-submit guard + happy-path create + `?rideId=` attaches the ride
- `src/components/TripDetailScreen.tsx` — `/trips/:id` screen; gradient trip header, combined `TripMap`, 3×3 combined-stats grid (Distance · Moving · Idle · Elapsed · Avg speed · Top speed · Max lean · Elev gain · Sessions), Session-by-session list of attached rides with per-session Remove button, "Add rides" CTA that opens `AddRidesToTripSheet`, "Share to Story" + Delete trip. Uses `listRidesForTrip` so rides come back oldest-first (Session 1 / Session 2 / …)
- `src/components/TripMap.tsx` — Leaflet multi-polyline wrapper; one color per session from an 8-color palette, `fitBounds` across the union of all sessions, single green start dot on the first ride and single red end dot on the last
- `src/components/AddToTripSheet.tsx` — inline card on the ride summary. Shows the current trip (with Remove) if attached, otherwise a picker of existing trips + a "New trip" link that deep-links to `/trips/new?rideId=…`. No modal — sits in the page flow
- `src/components/AddRidesToTripSheet.tsx` — full-screen multi-select modal launched from the trip detail screen; lists the rider's history via `listRides()`, hides rides already in this trip, and disables rides that are attached to a different trip (shows the other trip's name). Sticky "Add N rides" footer calls `addRideToTrip` once per selected ride
- `src/components/AddRidesToTripSheet.test.tsx` — covers hide-current + disable-other-trip + multi-select happy-path + disabled-until-one-selected + Cancel
- `src/features/share/exportTripPng.ts` — 1080×1920 Instagram-Story PNG compositor for an entire trip: multi-session route on one map (per-session colors matching `TripMap`), brand overlay tinted by the trip's cover gradient, hero tiles (TOTAL DISTANCE + SESSIONS / moving time), 2×3 stat grid, date range in the subtitle. Logo drawn via the shared `drawLogoTile` + `drawLogoMark` helpers
- `src/features/share/exportTripOverlayPng.ts` — 1080×1920 *transparent* PNG compositor for a whole trip: every session's route in per-session colors (same palette as `TripMap`), one stitched speed graph across the full trip, and total distance + total moving time as the two headline numbers. No background, no brand fills — drops cleanly over any photo
- `src/features/share/exportTripOverlayPng.test.ts` — throws when no ride has a usable route + emits a 1080×1920 PNG for a two-session trip
- `src/features/share/exportTripPng.test.ts` — throws when no ride has a route; produces a 1080×1920 PNG blob for a two-session trip; stubs `fetch` + `createImageBitmap` + canvas under jsdom
- `supabase/trips.sql` — creates `public.trips` with RLS scoped by `auth.uid()` and adds `trip_id` + index on `public.rides` with `ON DELETE SET NULL` so deleting a trip detaches its rides server-side too. Idempotent — safe to re-run. Owner executes it once after `schema.sql`

## Routing + shell

- `src/main.tsx` — React root; mounts router; registers service worker; starts the auth deep-link listener (`startAuthDeepLinkListener()`)
- `src/router.tsx` — routes: `/`, `/history`, `/ride/:id`, `/trips`, `/trips/new`, `/trips/:id`, `/community`, `/community/clubs/new`, `/community/clubs/:id`, `/community/events/new`, `/community/events/:id`, `/profile`, `/auth/callback`, `/privacy`; app routes wrapped in `<AuthGate>`; `/privacy` is intentionally outside the gate so store reviewers can read it without signing in
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
- `supabase/community.sql` — creates `public.clubs`, `public.club_members`, `public.club_events`, `public.event_rsvps` with RLS + triggers for `member_count`, `going_count`, and autojoining a club's creator. Owner runs it once in the Supabase SQL editor; idempotent on re-run. Instructions are in `store/account-setup.md` §7.
- `supabase/trips.sql` — creates `public.trips` with RLS and adds `trip_id` + index on `public.rides` (`ON DELETE SET NULL`). Idempotent — safe to re-run. Owner runs it once after `schema.sql`; instructions are in `store/account-setup.md` §7b.

## Native

- `ios/` — Xcode project (Capacitor)
- `android/` — Android Studio project (Capacitor)
- `ios/App/App/Info.plist` — privacy strings for location, `UIBackgroundModes=[location]`, `CFBundleURLTypes` for the `com.kunjdodiya.mototrack://` OAuth deep link
- `android/app/src/main/AndroidManifest.xml` — location + foreground-service-location + POST_NOTIFICATIONS + VIBRATE permissions, plus the deep-link intent-filter on MainActivity
- `assets/` — generated 1024×1024 source PNGs that feed `@capacitor/assets`; produced by `scripts/generate-native-assets.mjs`. Output is committed under `ios/App/App/Assets.xcassets/` and `android/app/src/main/res/`
- `capacitor.config.ts` — `android.useLegacyBridge: true` is required by the background-geolocation plugin to keep updates flowing past the 5-minute mark

## Types

- `src/types/ride.ts` — `TrackPoint`, `RideStats` (includes `idleDurationMs`, `maxLeanAngleDeg`), `Ride` (optional `name`, `bikeId`, `tripId`)
- `src/types/bike.ts` — `Bike` (`id`, `name`, `createdAt`, `syncedAt`)
- `src/types/trip.ts` — `Trip` (`id`, `name`, `coverColor`, `notes`, `createdAt`, `syncedAt`), `TripCover`, `TRIP_COVERS`
