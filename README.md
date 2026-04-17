# MotoTrack

A Strava-style motorcycle ride tracker. Record a ride with your phone's GPS,
get a route-on-map PNG with stats for Instagram/WhatsApp.

- **Web first**, installable as a PWA on iPhone and Android
- **Local-first** — rides store in IndexedDB, cloud-backed via Supabase
- **Google Sign-In required** — your rides follow your Google account across devices
- **Zero hosting cost** — Cloudflare Pages free tier + Supabase free tier
- **Native-ready** — Capacitor migration path is wired (platform adapter)

> **For AI agents working on this repo:** read [`AGENTS.md`](./AGENTS.md),
> [`IMPLEMENTATION.md`](./IMPLEMENTATION.md), and [`DECISIONS.md`](./DECISIONS.md)
> **before making any change**. Run `npm run agents:check` before finishing.

## Run locally

Requires Node 20 LTS or newer (the project was set up on Node 24 via nvm).

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build into dist/
npm run preview      # serve the production build
```

**Supabase is required.** The app shows a sign-in screen on boot; you
cannot use MotoTrack without both `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` set in `.env.local`. See the Supabase + Google
setup in step 1 below.

Use the **Seed demo ride** button (dev only) on the History screen to produce
a synthetic Vansda loop so you can test the map + PNG export without riding.

## Setup — step by step

### 1. Supabase + Google Sign-In (required)

MotoTrack needs a Supabase project for cloud storage and auth, and a Google
Cloud OAuth client so users can sign in.

**1a. Create the Supabase project**

1. Go to https://supabase.com and create a free account.
2. Create a new project. Any region near you (e.g. Singapore or Mumbai).
   Wait ~2 min for provisioning.
3. In the dashboard, go to **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), click Run.
4. Go to **Settings → API**. Copy **Project URL** + **anon public** key.

**1b. Create a Google Cloud OAuth client**

1. Go to https://console.cloud.google.com and create/select a project.
2. **OAuth consent screen** → External → fill in App name, user support
   email, developer contact. Add scopes `email`, `profile`, `openid`.
   Publish as "Testing" and add your own email as a test user.
3. **Credentials → Create OAuth 2.0 Client ID → Web application.**
4. Authorized JavaScript origins:
   - `http://localhost:5173`
   - `https://mototrack.pages.dev`
5. Authorized redirect URI (copy from Supabase Auth → Providers → Google):
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
6. Copy the Client ID + Client Secret.

**1c. Wire Google into Supabase**

1. Supabase dashboard → **Authentication → Providers → Google** → paste
   Client ID + Client Secret → Enable.
2. Supabase → **Authentication → URL Configuration** → Site URL =
   `https://mototrack.pages.dev`; add redirect URLs
   `https://mototrack.pages.dev/*` and `http://localhost:5173/*`.

**1d. Wire Supabase into the app**

Copy `.env.example` to `.env.local` and paste:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<the-anon-key>
```

Restart the dev server — you should see the Google Sign-In screen.

### 2. Deploy to Cloudflare Pages (free, auto on push)

Every push to `main` triggers `.github/workflows/deploy.yml`, which
installs deps, runs lint + tests, builds the Vite bundle, and deploys
it to https://mototrack.pages.dev via `wrangler pages deploy`. If any
step fails, the site is not updated.

The workflow needs these GitHub Actions secrets set on the repo
(Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — a token scoped to **Account → Cloudflare Pages → Edit**
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID (visible via
  `npx wrangler whoami`)
- `VITE_SUPABASE_URL` — same value as `.env.local`
- `VITE_SUPABASE_ANON_KEY` — same value as `.env.local`

To deploy manually from your Mac instead, `npm run deploy` still works
(runs `wrangler pages deploy dist` against the same project).

## On your phone

- Open the `*.pages.dev` URL in Safari (iPhone) or Chrome (Android).
- Grant location permission when you tap Start.
- **iPhone:** tap Share → Add to Home Screen to install (one-time hint in-app).
  Keep the screen on during recording — iOS Safari pauses JS when the screen
  locks. Capacitor native app (v2) fixes this.
- **Android:** tap the Install prompt at the top of the app.

## Architecture

- **Framework:** React 19 + Vite 8 + TypeScript, Tailwind v3, React Router.
- **Map:** Leaflet + OpenStreetMap tiles (free, no API key).
- **Local storage:** Dexie (IndexedDB) — `src/features/storage/`.
- **State:** Zustand store for the active recording session.
- **PNG share image:** custom offscreen-canvas compositor in
  `src/features/share/exportPng.ts`. Fetches OSM tiles via
  `fetch → blob → createImageBitmap` (CORS-clean), projects route points via
  Web Mercator, composites the stats card rendered by html-to-image.
- **Cloud sync:** Supabase with anonymous auth + RLS scoped by `auth.uid()`.
- **Platform adapter:** `src/features/platform/` — web impl today, Capacitor
  native swappable in v2 via `capacitor.ts` (currently a stub with migration
  instructions).
- **PWA:** hand-rolled `public/sw.js` (vite-plugin-pwa does not yet support
  Vite 8). CacheFirst for OSM tiles, NetworkFirst with shell fallback for
  navigations.

## Native iOS / Android build (for background GPS)

Capacitor is already wired in. The same React bundle that ships to
`mototrack.pages.dev` also runs inside a native shell — the platform
adapter switches automatically via `Capacitor.isNativePlatform()`.
Everything in `src/features/platform/capacitor.ts` is implemented
(geolocation, share, filesystem) and the required privacy keys are set
in `ios/App/App/Info.plist` and `android/app/src/main/AndroidManifest.xml`.

What's NOT in place (because it's local dev environment + Apple/Google
bureaucracy, not code):

### iOS — requirements

1. **Install Xcode.app** from the Mac App Store. ~12 GB download.
2. **Install CocoaPods**: `brew install cocoapods` (requires Homebrew)
   or `sudo gem install cocoapods`.
3. **Apple Developer account** — free tier works for installing on your
   own phone (re-sign every 7 days), $99/year for TestFlight or the
   App Store.
4. **Cable your iPhone in**, trust this computer on first connect, and
   enable Developer Mode on the phone (Settings → Privacy & Security →
   Developer Mode).

Then:
```bash
npm run cap:ios          # builds web, syncs, opens Xcode
```
In Xcode: pick your device from the top-left picker, pick your Apple ID
team under Signing & Capabilities, click Run.

### Android — requirements

1. **Install Android Studio**: https://developer.android.com/studio
   (~1 GB plus SDK downloads).
2. **Enable USB debugging** on your phone (Settings → About phone →
   tap Build number 7 times → Developer options → USB debugging).
3. **Cable your phone in** and approve the RSA fingerprint prompt.

Then:
```bash
npm run cap:android      # builds web, syncs, opens Android Studio
```
In Android Studio: wait for Gradle sync, pick your device in the top
toolbar, click Run.

### Everyday workflow after native is set up

Edit web code → `npm run cap:sync` → rebuild in Xcode/Android Studio.
Or just `npm run cap:ios` / `npm run cap:android` to do everything in
one command.

## Deploy the web version

After a code change:
```bash
npm run deploy
```
This runs `vite build` then `wrangler pages deploy dist` to
https://mototrack.pages.dev. Wrangler is already authenticated on
this Mac; it'll keep working as long as the OAuth token is valid
(~90 days). Re-auth with `npx wrangler login` if needed.
