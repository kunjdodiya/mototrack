# MotoTrack

A Strava-style motorcycle ride tracker. Record a ride with your phone's GPS,
get a route-on-map PNG with stats for Instagram/WhatsApp.

- **Web first**, installable as a PWA on iPhone and Android
- **Local-first** — rides store in IndexedDB, cloud sync is optional
- **Zero hosting cost** — Cloudflare Pages free tier + Supabase free tier
- **Native-ready** — Capacitor migration path is wired (platform adapter)

## Run locally

Requires Node 20 LTS or newer (the project was set up on Node 24 via nvm).

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build into dist/
npm run preview      # serve the production build
```

The dev server runs without Supabase — the app falls back to pure local-only
mode when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` aren't set.

Use the **Seed demo ride** button (dev only) on the History screen to produce
a synthetic Vansda loop so you can test the map + PNG export without riding.

## Setup — step by step

### 1. Supabase (optional but recommended)

Rides are backed up to Supabase so you don't lose them if you clear the browser.

1. Go to https://supabase.com and create a free account.
2. Create a new project. Any region near India (e.g. Singapore or Mumbai).
   Wait ~2 min for provisioning.
3. In the dashboard, go to **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), click Run. This creates
   the `rides` table with Row Level Security.
4. Go to **Settings → API**. Copy:
   - **Project URL**
   - **anon public** key
5. Copy `.env.example` to `.env.local` in the project root and paste:

   ```
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<the-anon-key>
   ```

6. Restart the dev server. Rides now sync.

**Known limitation:** this project uses *anonymous* auth, so clearing your
browser storage loses the cloud identity (rides remain on the device in
IndexedDB, but become unclaimed in the cloud). v1.1 can add Google sign-in.

### 2. Deploy to Cloudflare Pages (free)

The app is a static Vite build — no server needed.

1. Push this repo to GitHub (any visibility — public or private works).
2. Go to https://dash.cloudflare.com → **Workers & Pages → Create → Pages →
   Connect to Git**.
3. Pick the repo.
4. Build config:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node version (env var): `NODE_VERSION=20`
5. Environment variables — add the same `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` you put in `.env.local`.
6. Save. First deploy takes ~1 min. Your app is live at
   `https://<project>.pages.dev`.

Every `git push` to main re-deploys automatically.

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
