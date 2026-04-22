# DECISIONS.md

Append-only log of architectural decisions. Newest last. Format per entry:

```
## YYYY-MM-DD — Title

**Context:** what was the problem / forcing function.
**Decision:** what we chose.
**Consequences:** what this means for future work (good + bad).
```

Do not rewrite old entries. If a decision is reversed, add a new entry that supersedes it and link back.

---

## 2026-04-17 — React 19 + Vite 8 + TypeScript as the base stack

**Context:** Owner wants one codebase shipping to web, iOS, and Android, with the option to hire no human engineers. Needs strict typing (owner can't review diffs) and a build system that works inside Capacitor.

**Decision:** React 19 + React Router 7 on Vite 8, TypeScript in strict mode. Tailwind for styling.

**Consequences:** Same bundle runs on the PWA and inside the Capacitor shell. Vite 8 is new enough that `vite-plugin-pwa` lags — we hand-rolled the service worker in `public/sw.js`. Dev server is fast. Type errors block the build.

## 2026-04-17 — Local-first storage with Dexie, cloud sync via Supabase

**Context:** Motorcyclists ride through tunnels, dead zones, and foreign countries with expensive data. A ride dropped because the network hiccuped would kill trust.

**Decision:** Every ride writes to Dexie (IndexedDB) first. Supabase sync is best-effort and retried on next boot. `syncedAt === null` means still-unsynced; nothing else infers sync state.

**Consequences:** App works fully offline. Loss of the cloud never loses a ride. `src/features/storage/sync.ts` must never be on the critical path of Stop — it's always fire-and-forget. Conflict resolution is trivial because rides are immutable once stopped.

## 2026-04-17 — Platform adapter pattern for GPS, share, wake-lock

**Context:** Same React bundle runs in mobile web (navigator APIs), iOS native (Capacitor plugins), and Android native (Capacitor plugins). Without an adapter, feature code litters with `if (isNative)` branches.

**Decision:** `src/features/platform/` defines a `Platform` interface; `web.ts` and `capacitor.ts` implement it; `index.ts` picks one at runtime via `Capacitor.isNativePlatform()`. No other file may import `@capacitor/*` or touch `navigator.geolocation`.

**Consequences:** Adding a new platform capability = one interface edit + two implementations. Forgetting to update one adapter surfaces as a TypeScript error, not a runtime bug.

## 2026-04-17 — Google Sign-In is required; anonymous Supabase auth removed

**Context:** The app previously used Supabase anonymous sign-in. That made the cloud identity tied to `localStorage` — clearing browser data lost the identity, and rides couldn't move across devices. The owner wants to publish a paid app; a portable identity is non-negotiable.

**Decision:** Google Sign-In (Supabase OAuth provider) is the only auth method. The app shows a sign-in screen before any other UI. Anonymous mode is gone. Web OAuth redirect flow for now; native Capacitor flow is filed as a follow-up.

**Consequences:** The app is unusable without a Supabase project + Google Cloud OAuth credentials configured. Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are now **required** at build time. Rides are scoped by the Google user's `auth.uid()` automatically via RLS. The old `src/features/auth/anon.ts` is deleted.

## 2026-04-17 — Vitest + @testing-library/react as the test stack

**Context:** "Every new feature needs tests" is the safety net for an agent-built repo with a non-technical owner. The test runner has to be zero-config with Vite, fast, and use the same module resolution as the app.

**Decision:** Vitest for the runner, jsdom for the DOM environment, `@testing-library/react` for component assertions, `@testing-library/jest-dom` for matchers. Tests colocated next to source as `foo.test.ts(x)`.

**Consequences:** One dev dependency tree. Tests run in-process and share Vite's transform pipeline — no Babel/ts-jest drift. `npm run test:run` is a CI-safe one-shot; `npm test` is the watch-mode dev loop.

## 2026-04-17 — Auto-deploy to Cloudflare Pages via GitHub Actions on push to main

**Context:** Manual `npm run deploy` off the owner's Mac was the only path to production. That couples every release to one machine, one OAuth token, and one person remembering to run the command. The owner is non-technical and agent-built releases should land without them running a CLI.

**Decision:** Ship `.github/workflows/deploy.yml` that runs on every push to `main`: `npm ci → lint → test:run → build → cloudflare/wrangler-action@v3 pages deploy dist --project-name=mototrack --branch=main`. Secrets live in GitHub Actions (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Main is the only tracked branch; this repo does not use feature branches or PRs.

**Consequences:** A red test blocks the deploy — tests are now a release gate, not just a dev-time check. The existing `npm run deploy` script still works for emergency manual deploys from the Mac. No branch-protection rules, no PR gate — the workflow alone is the safety net, so any agent that wants to skip tests would have to edit the workflow in the same commit, which shows up clearly in `git log`. The Cloudflare API token is scoped to Pages:Edit only, so a leaked token can't touch Workers, DNS, or billing.

## 2026-04-17 — Self-validating agent docs via scripts/agents-check.mjs

**Context:** Three markdown files (AGENTS.md, IMPLEMENTATION.md, DECISIONS.md) rot if nobody enforces them. The owner can't spot-check, so the check has to be mechanical.

**Decision:** `scripts/agents-check.mjs` is a Node script wired as `npm run agents:check`. It validates that every file path mentioned in `IMPLEMENTATION.md` exists, that `DECISIONS.md` has no unclosed drafts, and that `AGENTS.md` references resolve. Agents run it before handoff. CI mode (`--ci`) additionally fails on a dirty git tree.

**Consequences:** Docs can't silently lie. Onboarding a new agent in session N+1 is a 3-file read with an auto-verified index. The script is small enough to teach new rules when conventions evolve.

## 2026-04-18 — Lean angle estimated from GPS trajectory, not IMU

**Context:** Owner wants a "max lean angle" stat on each ride. True lean requires gyro/accelerometer data (DeviceOrientation on web, CoreMotion on iOS, SensorManager on Android) — three platform adapters, three permission prompts, and a class of values that's still noisy without Kalman filtering.

**Decision:** Estimate peak lean from the existing GPS track. For each 3-point window we compute the bearing-change rate ω (rad/s) and the segment speed v (m/s), then lean = `atan(v·ω/g)`. Segments below ~3 m/s are ignored (GPS noise fakes huge ω at standstill) and results above 55° are discarded as obvious outliers. Implemented in `src/features/stats/leanAngle.ts`.

**Consequences:** Zero new permissions, zero new platform code, works identically on web/iOS/Android. The number is an estimate — sustained cornering reads accurate within a few degrees; quick flicks will under-read because GPS sample rate (1–2 Hz) misses the peak. If a future rider demands true lean we add a Capacitor motion plugin behind the existing `Platform` interface and prefer the IMU value when available — the type (`RideStats.maxLeanAngleDeg: number | null`) stays stable.

## 2026-04-18 — Bikes as a per-user Dexie table synced to Supabase

**Context:** Owner wants riders to register their bikes and tag each ride with one. Options: bikes as a free-text field on each ride (cheap, but no totals-per-bike), bikes as a separate entity only in Supabase (breaks offline), or bikes as a first-class Dexie table with its own sync.

**Decision:** New `bikes` Dexie table (`db.ts` bumped to v2 with an upgrade function that also backfills `idleDurationMs`/`maxLeanAngleDeg` on pre-existing rides) plus a matching `public.bikes` Supabase table with RLS scoped by `auth.uid()`. `Ride.bikeId` is an optional foreign key — rides without a bike stay valid. Bikes sync on sign-in via `syncUnsyncedRides()` (renamed in spirit; still called that for backwards compat).

**Consequences:** Riders can add a bike, pick it at ride start, and see per-bike ride counts on `/profile`. Delete-bike keeps the associated rides and only orphans the label (RLS cascade is only on `user_id`, not `bike_id`). Offline-first is preserved — the bike is saved locally first, the cloud push is fire-and-forget like rides.

## 2026-04-18 — Inter as the canonical sans-serif, loaded from Google Fonts

**Context:** Owner asked for a "very modern sans-serif." Default `-apple-system` stack renders San Francisco on iOS, Segoe UI on Windows, Roboto on Android — inconsistent, no tight letterforms at the sizes the Strava-style export poster uses.

**Decision:** Load Inter 400/500/600/700/800 from Google Fonts in `index.html` with `preconnect` on both `fonts.googleapis.com` and `fonts.gstatic.com`. Keep the system stack as fallback so first paint never waits on the CDN. Tailwind + `body` CSS + `ShareCard` inline style all declare Inter first.

**Consequences:** The PWA service worker caches font files after the first load — subsequent visits are offline-capable. html-to-image picks up the computed font-family on the off-screen poster node, so the PNG export renders Inter correctly. If Google Fonts becomes an availability concern the swap is one `<link>` edit away (or move to `@fontsource-variable/inter` for self-hosting).

## 2026-04-21 — Native Google Sign-In via PKCE + @capacitor/browser deep link

**Context:** Web OAuth redirect flow worked in the PWA but breaks inside the Capacitor WebView: Supabase tries to navigate the WebView to accounts.google.com, which loses the in-app back button, breaks the system password manager, and never returns to the app. AGENTS.md flagged "Native Google Sign-In flow for Capacitor iOS/Android" as out-of-scope, but it's the gating dependency for shipping the apps.

**Decision:** Switch the Supabase client to `flowType: 'pkce'`. On native, `signInWithGoogle()` calls `signInWithOAuth({ skipBrowserRedirect: true })` to receive the OAuth URL, opens it in `@capacitor/browser` (SFSafariViewController on iOS, Chrome Custom Tab on Android — these share cookies with the system browser, so a returning user is one tap), then waits for the deep-link return on `com.kunjdodiya.mototrack://auth/callback` via `@capacitor/app`'s `appUrlOpen` event. The deep-link handler extracts the `code` query/fragment param and calls `supabase.auth.exchangeCodeForSession(code)`. All `@capacitor/*` imports stay quarantined in `src/features/platform/capacitor.ts` per the existing platform-adapter rule — the auth code path goes through three new methods on the `Platform` interface (`openAuthUrl`, `closeAuthBrowser`, `onAppUrl`).

**Consequences:** One auth code path covers web + iOS + Android. PKCE works equally well on both surfaces (web uses `detectSessionInUrl`, native uses the explicit exchange). Two new native config bits are now part of the contract and must stay in sync with `NATIVE_AUTH_REDIRECT`: iOS `CFBundleURLTypes` and Android `<intent-filter>` on MainActivity. The Supabase project's redirect-URL allowlist and the Google OAuth client's authorized-redirect-URIs both need `com.kunjdodiya.mototrack://auth/callback` added in addition to the existing web URL — documented in `store/account-setup.md` step 6. PKCE requires `localStorage` to persist the code verifier between `signInWithOAuth` and `exchangeCodeForSession`; Capacitor's WebView provides this, so no extra storage shim was needed.

## 2026-04-21 — Background GPS via @capacitor-community/background-geolocation

**Context:** The default `@capacitor/geolocation` plugin uses `watchPosition`, which Android kills within seconds of the screen locking — fatal for a ride tracker, since putting the phone in a tank bag with the screen off is the normal mode of use. The fix on Android is a foreground service with a persistent notification; iOS already keeps `watchPosition` alive with `UIBackgroundModes=[location]`, but only if the user grants "Always" permission.

**Decision:** Add `@capacitor-community/background-geolocation` (Capacitor 8 compatible at v1.2.x). Replace the `Geolocation.watchPosition` call inside `capacitorPlatform.watchPosition` with `BackgroundGeolocation.addWatcher`, passing `backgroundMessage` + `backgroundTitle` (which is what flips the watcher into foreground-service mode on Android). Set `android.useLegacyBridge: true` in `capacitor.config.ts` per the plugin's documented requirement to keep updates flowing past the 5-minute mark. Keep the basic `@capacitor/geolocation` plugin around only for `checkPermissions()` since the permission state surface is identical between the two and there's no point reaching for the bigger plugin twice.

**Consequences:** Android shows a persistent "MotoTrack — recording ride" notification while a watcher is active; tapping it returns to the app. This satisfies Android 14's foreground-service-location runtime requirement, and the existing `FOREGROUND_SERVICE_LOCATION` + `POST_NOTIFICATIONS` permissions in `AndroidManifest.xml` are sufficient. iOS unchanged behaviour-wise but goes through the same plugin so the call site stays single-codepath. Bundle size on native goes up by ~80 KB; web bundle is unaffected (Vite tree-shakes `@capacitor-community/*` when `Capacitor.isNativePlatform()` is false at build time? Actually no, it doesn't — but the import only resolves at runtime via `registerPlugin`, and the JS surface is tiny).

## 2026-04-21 — Privacy policy lives at /privacy, outside the AuthGate

**Context:** Both App Store Connect and Play Console require a public, hosted privacy policy URL. The reviewer must be able to reach it without signing in, and so must any user reading the store listing.

**Decision:** Add `src/components/PrivacyScreen.tsx` rendered at `/privacy` as a top-level route OUTSIDE the `<AuthGate>` wrapper in `src/router.tsx`. Link to it from `SignInScreen.tsx` so even a brand-new visitor on the landing page can see it. Same URL — `https://mototrack.pages.dev/privacy` — is what we hand to both stores.

**Consequences:** One source of truth for the policy text (`PrivacyScreen.tsx`), versioned with the rest of the code, edits ship via the existing Cloudflare Pages auto-deploy. If the policy needs to change after launch we update the React component, deploy, and update the `LAST_UPDATED` constant — no separate static-site or external PaaS to maintain.

## 2026-04-21 — Two-way cloud sync on sign-in (push + pull for rides and bikes)

**Context:** Signing in on a second device (same Google account) showed an empty history and an empty profile. The original `sync.ts` only pushed local rides/bikes to Supabase — it never pulled. Rides recorded on device A existed on the server but never landed in device B's Dexie, so history, profile totals, and the bike dropdown looked empty on every new device. Profile basics (email/avatar) come straight from the Supabase session and already travel with the account; the missing piece was the user-owned data in the `rides` and `bikes` tables.

**Decision:** Add `pullRemoteRides()` and `pullRemoteBikes()` that `select *` from their respective tables (RLS filters to `auth.uid()`) and `bulkPut` into Dexie with `syncedAt = now`. Bundle push + pull in `syncWithCloud()` and call it from `AuthGate` on sign-in instead of the old push-only `syncUnsyncedRides()`. Server rows are authoritative once synced, so pulls overwrite local copies by id — safe because rides are immutable after Stop and bikes only mutate via rename (which flips `syncedAt=null` and gets re-pushed on the next sync).

**Consequences:** Cross-device history, profile totals, and bike garage now reconcile on every sign-in. `useLiveQuery` in `HistoryList` + `ProfileScreen` picks up pulled rows automatically. Cost: each sign-in does two extra `select` calls; the existing `(user_id, started_at desc)` and `(user_id, created_at)` indexes keep them cheap. A multi-user-on-one-device case (account A signs out, account B signs in on the same phone) still leaves A's Dexie rows behind — filed as a separate concern since MotoTrack targets personal devices.

## 2026-04-21 — Profile photo + legal documents live in Supabase Storage, not Dexie

**Context:** Owner asked the profile page to show the rider's Google name + photo with an option to upload a custom picture, and to store legal documents (licence, insurance) as PDFs or JPGs viewable inside the app. The rest of the app is local-first (Dexie) for a reason — rides must survive network loss — but photos and paperwork are bulky binary blobs that don't fit IndexedDB cleanly and aren't on the critical path of any ride.

**Decision:** Use Supabase Storage for both, with two buckets:

- `avatars` (public): each user writes to `<user_id>/avatar-<ts>.<ext>`. Public URL is what `<img src>` uses; the chosen URL is saved to `user_metadata.custom_avatar_url` via `supabase.auth.updateUser()`. `getProfileInfo(session)` returns `custom_avatar_url ?? avatar_url ?? picture`, so clearing the custom field falls straight back to Google's photo.
- `documents` (private): `<user_id>/<ts>__<kind>__<slug>.<ext>` where `kind ∈ {license, insurance, other}`. `DocumentViewer` opens the file via a short-lived (10-minute) signed URL — iframe for PDFs, `<img>` for images. No Dexie cache layer.

RLS uses `(storage.foldername(name))[1] = auth.uid()::text` so a user can only touch objects in their own folder. Owner runs `supabase/storage.sql` once to create the buckets + policies (documented in `store/account-setup.md` §6).

**Consequences:** One source of truth per artifact, synced across devices the moment it's uploaded. Documents are unavailable offline — acceptable because they're reference material, not ride-critical. The "local-first" rule in AGENTS.md still holds: it was always about *rides*, not every byte the app handles. Metadata for an uploaded document is fully encoded in the filename (`<ts>__<kind>__<slug>`), so no sidecar table is needed — one SQL file does the whole feature.

## 2026-04-21 — Native icons + splash generated from one SVG via @capacitor/assets

**Context:** Both stores require a 512×512 (Play) / 1024×1024 (Apple) PNG icon plus a per-density set for every platform target. Hand-curating those 100+ files is a maintenance nightmare and easy to get wrong (Android adaptive icons in particular have a foreground/background split that needs the right safe-area).

**Decision:** Add `scripts/generate-native-assets.mjs` (run via `npm run native:assets`) that uses `sharp` to rasterise `public/icon-512.svg` to a few canonical 1024×1024 / 2732×2732 PNGs in `assets/`, then shells out to `npx @capacitor/assets generate` with the brand-dark `#0a0a0a` background. The output PNGs are committed under `ios/App/App/Assets.xcassets/` and `android/app/src/main/res/`.

**Consequences:** The brand changes at one source-of-truth file (`public/icon-512.svg`). Re-running the script regenerates every native + PWA size. The script is idempotent — checking the diff after a run shows whether the source art actually changed. `sharp` is added as a dev-only dependency (~15 MB), worth it for the avoidance of a separate design-tool round-trip per icon update.

## 2026-04-21 — Bottom tab bar shell + Community tab (native-feeling redesign)

**Context:** Owner asked for a native-app feel on iOS + Android instead of the previous top-header web layout. Four destinations belong in the primary navigation: Ride Now (recorder), My Rides (history), Community (new — clubs + ride hosting), My Profile. The top-header nav also made Sign Out feel like a chrome element instead of a profile setting.

**Decision:** Replace the `<App>` top-header layout with a floating glass `BottomTabBar` pinned to `env(safe-area-inset-bottom)` and four persistent tabs with animated gradient pill indicators. `App.tsx` keeps its `InstallHint` toast + `<Outlet />` and re-keys `<main>` on `location.pathname` so every route transition triggers a `page-enter` animation. Sign Out moves inside `ProfileScreen`. A new `/community` route renders `CommunityScreen`, which is labelled as a preview — the clubs and hosting data are placeholder until the backend schema for clubs/events ships. Design tokens live in `tailwind.config.js` (`brand-gradient`, `moto-mesh`, `Space Grotesk` display font, `animate-pulse-ring` / `animate-fade-up`) and a mesh-gradient body background in `index.css`; `@media (prefers-reduced-motion)` disables animations.

**Consequences:** All primary navigation is reachable by thumb; looks and feels like a native app shell on both platforms. Adding a fifth top-level destination requires a new entry in `BottomTabBar` *and* a new route. Community is a shell only — the next iteration needs a `clubs` + `club_events` schema with RLS and a join/leave flow; until then the chips and cards render static data so the tab doesn't feel empty. Page transitions are CSS-only (no `framer-motion`) to keep the bundle flat and respect motion preferences automatically.

## 2026-04-21 — Community MVP: clubs, open-join memberships, in-club events, one-tap RSVP

**Context:** The previous Community tab was a shell with placeholder data. Owner approved building the MVP: four Postgres entities (clubs, memberships, events, RSVPs), two-tap join, in-club event hosting, text-only meet-points (no route planner), no chat, no approval-gated joining.

**Decision:** Add `supabase/community.sql` with four RLS-scoped tables:

- `clubs` — read by any authenticated user (so discovery works), insert by any authenticated user (with `created_by = auth.uid()`), update/delete only by the owner. A denormalised `member_count` column is maintained by trigger so the browse list can sort by popularity without exposing the member roster.
- `club_members` — row read is scoped to `user_id = auth.uid()` (you only see your own memberships). Self-join via insert, self-leave via delete, club owner can also remove. We deliberately never expose per-club rosters in MVP to avoid leaking `auth.users.id`s.
- `club_events` — read by any authenticated user (enables cross-club discovery). Insert gated by a subquery against `club_members` (only members of the parent club can create events). Update/delete restricted to the event creator or the club owner.
- `event_rsvps` — read by any authenticated user (so the app can show attendee totals without leaning on the trigger-maintained counter). Write restricted to `user_id = auth.uid()`. A trigger maintains `club_events.going_count` on inserts, deletes, and status transitions across the `going` boundary.

An auto-join trigger on `clubs` makes the creator the first member the moment a club is inserted, which keeps the "only members can create events" policy satisfiable without a second client round-trip.

Client-side: `src/features/community/{clubs,events,accents}.ts` expose a thin typed layer over the RPCs, and the data comes live from the Community screens — no Dexie cache. Social data is not ride-critical and needs real-time consistency; the local-first rule in `AGENTS.md` still applies to *rides*, not the social graph. The `CommunityScreen` now drives real Clubs/Host panels; four new screens (`NewClubScreen`, `ClubDetailScreen`, `NewEventScreen`, `EventDetailScreen`) handle the create/detail/RSVP flows. A shared `BackLink` chip keeps the back-affordance consistent inside the bottom-tab shell.

Explicit MVP scope cuts (deferred, filed separately):
- No chat / comments.
- No route planner. Events carry a single `meet_label` text plus optional `meet_lat`/`meet_lng` columns reserved for a later map-picker.
- No invite links / private clubs / approval-gated joining (open-join only).
- No push notifications.
- No distance-based discovery (city string only; no geocoding).

**Consequences:** Anyone signed in can browse clubs, join with one tap, host rides inside their clubs, and RSVP. The `member_count` / `going_count` triggers keep listings cheap (no per-row aggregate queries) at the cost of a denormalised write path — standard social-app trade-off. Read-by-any-authenticated on `club_events` and `event_rsvps` is the most permissive policy; it's safe because rows contain no PII beyond `auth.users.id` uuids, but it means "private events" can't be added without revisiting the policy. The `NewEventScreen` had to push its "is the start in the past?" check into the submit handler instead of the render-time `disabled` expression because the React 19 `react-hooks/purity` rule flags `Date.now()` inside render.

## 2026-04-21 — `@capacitor/haptics` for native Taptic Engine + vibrator feedback

**Context:** Recorder actions (start, pause, resume, stop) already fire synthesized Web Audio chimes but had no tactile feedback. On the web we can reach the Vibration API; on iOS Safari there is no web haptics path at all; on the native iOS + Android shells we want real Taptic Engine / vibrator pulses, not a silent fallback.

**Decision:** Add the optional `hapticTap(style)` method to the `Platform` contract (`src/features/platform/types.ts`) with three intensities (`light`, `medium`, `heavy`). The web implementation maps those to a static `navigator.vibrate()` pattern (silent on iOS Safari — acceptable, there is no workaround). The Capacitor implementation uses `@capacitor/haptics` `Haptics.impact({ style })` so iOS fires the Taptic Engine and Android uses the system vibrator. `@capacitor/haptics` is pinned to `^8.0.2` to match the other `@capacitor/*` v8 plugins. The Haptics plugin is registered in both native projects via `npx cap sync` (commits `android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle`, and `ios/App/CapApp-SPM/Package.swift`). Android also needs the `android.permission.VIBRATE` manifest entry, added to `android/app/src/main/AndroidManifest.xml` — it is a normal (install-time) permission, no runtime prompt.

**Consequences:** Feedback is now multi-modal without coupling the recorder to either API directly. Any new feature that wants a haptic just calls `platform.hapticTap(...)` — it has no idea whether it runs on iOS, Android, or Chrome. The owner must rebuild the native iOS + Android apps once so the new pod / Gradle entries land in signed store builds; until then TestFlight / Play Internal builds silently no-op on haptics even though the web preview works on Android Chrome. Future additions (e.g. selection haptics on RSVP) can be a simple `platform.hapticTap('light')`.

## 2026-04-21 — Share PNG as a 1080×1920 Instagram Story, painted purely in canvas

**Context:** The first-gen share image was a 1080×1620 poster: map tiles drawn to a canvas, then a React `<ShareCard poster>` rasterised via `html-to-image` and composited on top. It worked, but the aspect ratio got letterboxed when the user posted it to Instagram Stories (the default sharing target on mobile), the design was conservative (dark card + orange accent only), and the `html-to-image` path introduced the Safari-canvas-taint risk that the map-tile compositor was explicitly written to avoid. Owner asked for a social-ready redesign.

**Decision:** Rewrite `features/share/exportPng.ts` as a single 1080×1920 pure-canvas compositor — the exact Instagram Story spec, so the PNG drops into a Story without scaling or cropping. Everything (map, route, MotoTrack logo, ride title, bike chip, hero stat tiles, 3×2 stat grid, footer) is painted with `CanvasRenderingContext2D` and its gradient/roundRect primitives. The brand gradient (`#ff4d00 → #ff2d87 → #7c3aed`) is used as a diagonal wash over the map, as a radial glow behind the logo, as the fill for the ride-title text, and as the value gradient on the two hero tiles (Distance + Top Speed). The app-icon mark is re-drawn from its SVG path in canvas — no SVG-in-canvas tainting. Fonts: `await document.fonts.ready` before painting so Space Grotesk / Inter actually render (canvas will silently fall back to the system sans otherwise). Dropped `html-to-image` entirely; `ShareCard` keeps its inline variant (still used on the summary screen) but the `poster` prop + off-screen `ShareCard` mount in `RideSummary` are gone. `SpeedGraph`'s `poster` variant went with it. The share sheet (`platform.sharePng`) is unchanged — iOS/Android already route shared PNGs into Instagram's "Add to Story" composer automatically.

**Consequences:** One artifact, one path — the same PNG works for Instagram Stories, WhatsApp Status, X, Threads, and the generic native share sheet. Design is bolder (brand-gradient title, gradient-filled hero values, multiply-tinted map background) and ultra-modern without sacrificing legibility. Removing `html-to-image` trims ~60 KB from the web bundle and removes the only remaining `toCanvas`-on-DOM code path, so the Safari taint risk is gone. The compositor is now ~430 lines of canvas code; the trade-off is that visual tweaks need a reload+rerender loop rather than DevTools CSS editing, but the shape is stable and the public API (`renderSharePng({ ride })`) stays trivial. Hero tiles intentionally surface DISTANCE + TOP SPEED — those are the "brag" stats riders want to share; duration/moving/idle/avg/lean/elev live in the 3×2 grid below.

## 2026-04-21 — Trips as a per-user group over rides (local-first + one-shot RLS table)

**Context:** Multi-day tours (Ladakh, coastal loops, weeklong rallies) currently record as N disconnected rides. Owner asked for a way to combine those individual days into one recap so a rider can see the whole trip's distance / moving time / elevation in one place, view every day's route on a single map, and share one poster instead of five. Two shapes were considered:

1. **Virtual trips** — pick N rides ad hoc, render combined stats on the fly, never persist. Cheap but the grouping doesn't survive device changes, and a "trip" couldn't own a name, notes, or a cover colour.
2. **First-class entity** — a `trips` table (Dexie + Supabase) with a nullable `trip_id` foreign key on rides. More plumbing, but trips become shareable, nameable, indexable, and survive sign-in on a new device.

**Decision:** First-class entity. Concretely:

- New `Trip` type (`src/types/trip.ts`) with `id`, `name`, `coverColor`, optional `notes`, `createdAt`, and a sync flag.
- Dexie v3 migration adds a `trips` table and a `tripId` index on `rides`. No data migration is needed — pre-existing rides simply carry no `tripId`.
- A ride belongs to **at most one trip** (single nullable `tripId`). Many-to-many was considered and rejected: riders don't need to reuse a day across multiple trips, and the one-to-many shape keeps the UI picker and the combined-stats math obvious.
- `supabase/trips.sql` creates `public.trips` with RLS scoped by `auth.uid()` and adds `rides.trip_id` with `ON DELETE SET NULL`, so deleting a trip server-side detaches — never deletes — its rides. Local `deleteTrip()` performs the same detach before removing the row so Dexie never keeps a dangling `tripId`. Sync order in `syncUnsyncedRides()` pushes trips before rides so a ride carrying a fresh `trip_id` always finds its parent row already on the server.
- Combined stats live in a dedicated pure function (`src/features/trips/combineStats.ts`). Trip avg speed is derived from total distance ÷ total moving time (not an average of per-day averages), top speed and max lean are taken as maxes across days, elevation gain is summed only if every day reports a value, and the span (`startedAt`, `endedAt`) is the union of every ride's range. Implementing this as pure data → data keeps the TripDetailScreen dumb and the share compositor reuses the same function.
- The map uses one Leaflet surface with one colored polyline per day (`src/components/TripMap.tsx`) and a matching palette in the canvas share compositor (`src/features/share/exportTripPng.ts`), so the in-app preview and the exported Story show the same colors in the same order.
- Entry points follow the "obvious next step" principle: History shows a Trips strip + a trip badge on any ride that belongs to one; the single-ride summary gets an `AddToTripSheet` that either shows the attached trip (with Remove) or offers the existing trips + a "New trip" deep link (`/trips/new?rideId=…`) that creates the trip AND attaches the ride in one submit. No new bottom-tab entry — the feature sits under "My Rides" rather than competing for the fifth tab slot.

**Consequences:** Trips survive every cross-device sign-in because the sync pipeline now covers a third table. The `ON DELETE SET NULL` FK and the local cascade-detach in `deleteTrip()` mean deleting a trip is always safe — rides stay put, just un-grouped. The shared palette between `TripMap` and `exportTripPng` is not enforced by a constant — both files keep their own `DAY_COLORS` array so the file that ships to the bundle doesn't pull an extra module on a single-ride screen; the duplication is eight strings and the trade-off is explicit. The combined-map is read-only — reordering days visually is not exposed in MVP; rides in `TripDetailScreen` come back sorted by `startedAt` (oldest first = Day 1 / Day 2 / …) which is what riders actually want. The Instagram Story export reuses the brand gradient overall but tints the warm overlay + radial glow with the trip's chosen cover colour, so five different tours will look visually distinct in a feed without extra design work.

## 2026-04-22 — Continuous cross-device sync: pull on every foreground, not just sign-in

**Context:** Two devices (iOS + Android, or web + iOS) signed into the same Google account fell out of step between sign-ins. The previous decision (2026-04-21 — "Two-way cloud sync on sign-in") only fired `syncWithCloud()` from `AuthGate` when `userId` first changed to non-null. A rider already signed in on device A who recorded a ride on device B would not see that ride on A until they signed out and back in. The bug manifested as "my Android ride is missing on my iPhone" even though the server had it. Supabase RLS and the `rides`/`bikes`/`trips` selects were already correct; the missing piece was the trigger.

**Decision:** Add `src/features/storage/liveSync.ts`. `startLiveSync()` runs a pull-only `pullFromCloud()` + a `syncUnsyncedRides()` retry whenever the app returns to the foreground, and every 90s while it stays foregrounded. Triggers:

- `document.visibilitychange` → visible (web PWA + Capacitor WebView)
- `window.focus` (belt-and-braces on desktop where visibilitychange doesn't always fire on cross-window focus changes)
- `platform.onAppResume` — new method on the `Platform` interface that forwards Capacitor's `appStateChange` filtered to `isActive: true`; web is a no-op
- a 90s interval, armed while visible and cleared when hidden, so a rider with both apps open simultaneously still picks up the other device's ride within a tick

`AuthGate` now wires `startLiveSync()` into the same effect that fires the initial `syncWithCloud()` and returns the unsubscribe as the cleanup fn, so sign-out tears it down. Pulls are serialised by an in-flight guard — overlapping triggers (focus + visibility firing back-to-back on iOS Safari) never stack. The network path is pull-only on these ticks; `syncUnsyncedRides()` is cheap (iterates Dexie, filters `syncedAt == null`, short-circuits when empty) and covers the "app was offline when the user tapped Stop" case without adding a new code path.

Realtime (Supabase `postgres_changes` subscriptions) was considered and deliberately skipped for now: it would need `alter publication supabase_realtime add table public.rides` in SQL that the owner re-runs, an always-on WebSocket per device, and a reconnect-storm story. Visibility-based pulling gives the user-visible behaviour ("open the app → see my rides") with zero server-side changes and no long-lived connection on a data-metered mobile plan. If push-latency ever matters more than these trade-offs, realtime slots in on top of the same `pullFromCloud()` handler.

**Consequences:** Any device signed into the account now re-syncs the instant it's brought to the foreground, the window gains focus, or once every 90s while it's open — so a ride recorded on device B lands on device A on the next glance, not the next sign-in. The `AuthGate` effect now returns a cleanup fn, so swapping accounts on a shared device cancels the previous user's sync timer before the next one starts (Dexie rows from the signed-out account still linger on that device — that's the "multi-user-on-one-device" concern already filed under the 2026-04-21 sync decision, unchanged by this one). The new `Platform.onAppResume` keeps all `@capacitor/*` imports in `src/features/platform/capacitor.ts` and avoids adding a `document.visibilitychange` listener inside a platform-adapter-bypass. Bundle impact is a single new module (~1 KB minified). No Supabase schema changes.

## 2026-04-22 — "Forgot to stop?" retroactive ride trim

**Context:** Riders routinely park, grab dinner, and forget that the recorder is still running — the ride ends up with two or three extra hours of stationary GPS drift baked into distance and duration. Deleting and re-recording isn't an option (the ride already happened) and editing a finished ride risks mutating data that's already been synced. The owner specifically asked for a way to stop "a few hours and a few kilometers before" the moment they actually tap Stop.

**Decision:** Add a third action to the live recording screen — a subtle "Forgot to stop? Trim ride →" link below Pause/Stop — that opens `ForgotToStopSheet`. The sheet lets the rider pick a cutoff (preset chips from 15 min to 8 hr ago, plus a custom hours input) and previews Kept vs Dropped distance + duration before they confirm. Confirm calls a new `useRecorder.stopAt(endedAt)` action that truncates `points` where `ts <= endedAt`, re-runs `computeStats` with the new endedAt, and saves the trimmed ride through the same local-first `saveRide` + fire-and-forget `pushRide` path as regular `stop()`. The cutoff is clamped to `[startedAt, Date.now()]` in the store so a stale sheet, a custom input with a silly number, or clock skew can never produce a negative-duration ride.

**Consequences:** The "forgot to stop" path is a first-class live-screen action rather than a post-hoc ride editor — no new schema, no new sync code, no mutation of already-synced rides. Because `stopAt` goes through the same save + sync pipeline as `stop`, the cloud sees a normal ride; Supabase doesn't know or care that the rider chose a non-`Date.now()` `endedAt`. The alternative — letting the rider trim a ride from the summary screen after the fact — was rejected: it would need a mutation path for rides that may already be on another device, and dragging a slider over a route map is a bigger UI surface than the preset chips. The sheet's preset ceiling (8 hr) is a soft guard, not a hard limit — the custom input can exceed it; the in-sheet "too much" warning is the only block and it's driven by the actual ride duration, so a 12-hour ride can trim 10 hours if the rider really wants. `liveDistanceMeters` is subtracted from the preview distance to show "Dropped" — that's an approximation (the live counter sums accepted-point haversines, the preview sums only points up to the cutoff) but good enough for a user-facing "you'll lose about X km" readout.
