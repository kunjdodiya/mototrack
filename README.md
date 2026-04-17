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

## Capacitor migration (v2, for native background GPS)

Main constraint in v1: iOS Safari pauses JS when the screen locks, so
true background tracking needs the native app. When you're ready:

```bash
npm i @capacitor/core @capacitor/ios @capacitor/android \
      @capacitor/geolocation @capacitor/share @capacitor/filesystem
npx cap init mototrack com.kunjdodiya.mototrack
npx cap add ios && npx cap add android
```

Then implement the three methods in
[`src/features/platform/capacitor.ts`](./src/features/platform/capacitor.ts)
and flip `src/features/platform/index.ts` to export `capacitorPlatform`.
No other code changes.
