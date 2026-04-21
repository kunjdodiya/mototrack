# AGENTS.md — How to build MotoTrack

This repo is built exclusively by AI coding agents. The human owner is **non-technical**; they cannot review diffs line-by-line. Your safety net is tests + the three canonical docs.

**Before you do anything, read these three files at repo root in order:**

1. **AGENTS.md** (this file) — rules of the road
2. **IMPLEMENTATION.md** — what currently exists and where
3. **DECISIONS.md** — architectural choices already made and why

If your change contradicts any of them, you're almost certainly wrong. Stop and reconcile.

---

## Product at a glance

**MotoTrack** is a motorcycle GPS ride-tracking app intended for paid app-store release. It is a single React codebase that ships three ways:

- **Web PWA** at https://mototrack.pages.dev (Cloudflare Pages)
- **iOS native** via Capacitor (Xcode → App Store / TestFlight)
- **Android native** via Capacitor (Android Studio → Play Store)

See `IMPLEMENTATION.md` for the authoritative file-by-file map.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React 19 + React Router 7 | Owner wants one codebase across web + native |
| Build | Vite 8 | Fast, clean ESM; fewest moving parts |
| Language | TypeScript 6, strict | Non-technical owner needs compile-time safety |
| Styling | Tailwind CSS 3 | Speed of iteration, no bikeshedding |
| Native shell | Capacitor 8 | One codebase → iOS + Android with background GPS |
| Auth + DB | Supabase (Google OAuth, Postgres, RLS, Realtime) | Managed, free tier, RLS gives per-user isolation for cheap |
| Local storage | Dexie 4 (IndexedDB) | Offline-first; rides survive network loss |
| State | Zustand | Tiny, idiomatic for the recorder session |
| Map | Leaflet + OpenStreetMap | Free, no API key |
| Tests | Vitest + @testing-library/react + jsdom | Vite-native, fast, identical config |

## Conventions

### File layout

All app code under `src/`. Feature-first folders, one responsibility each:

```
src/
  components/           one component per file, PascalCase.tsx
  features/
    auth/               session, Supabase client, AuthGate
    recorder/           zustand store, GPS watch wrapper, smoothing
    stats/              pure functions (haversine, computeStats, format)
    storage/            Dexie schema, ride CRUD, cloud sync
    platform/           web vs capacitor runtime adapter
    share/              PNG export, native share
    map/                leaflet helpers
    pwa/                service worker registration
  types/                shared TS types, one file per entity
  test/                 test setup (vitest globals, jest-dom)
```

Platform-specific code lives in `features/platform/` behind the `Platform` interface — **never** import `@capacitor/*` or touch `navigator.geolocation` outside there.

### Code style

- **Strict TypeScript.** No `any`. No `as unknown as X` tricks. If you reach for a cast, you probably have the wrong type.
- **No comments explaining what code does.** Named identifiers do that. Comments are only for non-obvious *why* (invariants, workarounds, surprising behavior).
- **No backwards-compat shims.** If you rename, rename everywhere. Don't leave re-exports or `// removed` trails.
- **No premature abstraction.** Three similar lines beats a bad helper. Wait for four.
- **No dead code.** Delete.
- **Errors at boundaries only.** Trust your own code. Validate at network, user input, and file-system edges.
- **Small diffs.** One feature = one PR. Refactors ride separately.

### Commit messages

One-line imperative summary, optional body. Example: `Add Google Sign-In auth gate (web OAuth)`. No emoji, no prefixes like `feat:`.

### Tests — every new feature needs tests

This is the rule. The owner can't read your code; tests are how future agents (and the owner's CI) know it works.

- **Pure functions** (stats, math, formatters, validation): full unit coverage of edge cases. Colocated as `foo.test.ts` next to `foo.ts`.
- **React components**: at least one render test using `@testing-library/react` that asserts the key behavior. Not a snapshot test.
- **Side-effect modules** (auth, storage, GPS): mock the external dependency and assert the happy-path + the error path.
- Run `npm run test:run` before finishing.

### When you're done

Before handing off, run — **in order**, fixing anything that fails:

```bash
npm run lint       # no new warnings, no new errors
npm run build      # tsc + vite, must pass clean
npm run test:run   # every test green
npm run agents:check  # canonical-docs drift check
```

Then update the two living docs:

- **`IMPLEMENTATION.md`** — add/edit the section for what you built
- **`DECISIONS.md`** — append a dated entry only if you made an architectural call (new lib, schema change, renamed concept, new convention)

Finally: update this file (`AGENTS.md`) if you learned something that future agents will need to know. This is the self-validating loop — the doc improves with every change.

## Hard rules (do not violate)

- **Never touch `navigator.geolocation` outside `src/features/platform/`.**
- **Never import `@capacitor/*` outside `src/features/platform/` + `capacitor.config.ts`.** Use the `Platform` interface.
- **Never bypass Row Level Security.** Every Supabase query scopes by `auth.uid()` implicitly. If you need a cross-user read, write a Postgres function with security-definer instead of disabling RLS.
- **Never commit secrets.** `VITE_SUPABASE_*` is public (anon key is fine), but service-role keys, OAuth client secrets, Apple/Google signing keys stay out of git. Put them in Cloudflare Pages env vars or the native keychain.
- **Never break the local-first flow.** Network is always "maybe." A ride must save to Dexie first, *then* try to sync. Never await a network call on the critical path of Stop.
- **Never skip tests to ship.** If a test fails, the feature is broken. Do not comment it out, do not `it.skip`, do not pass `--no-verify` to git.

## What's out of scope right now

These are **filed as separate tasks** and have improvement chips:

- **Group Rides** — create ride, share invite link, see participants, group history. Dedicated feature with its own schema.
- **Ride analytics on history** — charts + weekly/monthly totals + personal records.

If the owner asks for any of these, resume that chip's session rather than starting fresh.

## Shipping to the App Store + Play Store

Native iOS/Android shipping has its own kit at [`store/`](./store/):
- `store/account-setup.md` — one-time owner tasks (Apple Dev enrollment, Play Console enrollment, keystore generation, Supabase + Google Cloud redirect-URL config)
- `store/apple.md` and `store/google.md` — copy-paste listing fields
- `store/screenshots.md` — required sizes
- `store/shared-description.md` — single source of truth for the long description

Build locally:
- `npm run cap:ios` → opens Xcode (Archive → Distribute App)
- `npm run cap:android` → opens Android Studio (Generate Signed App Bundle)
- `npm run native:assets` → re-runs the icon+splash generator if `public/icon-512.svg` changes

## Self-validation

Running `npm run agents:check` verifies:

- Every file referenced in `IMPLEMENTATION.md` exists
- `DECISIONS.md` has no `TODO:`/`DRAFT:` markers
- `AGENTS.md` file paths resolve
- `src/` has no stray `console.log` (warn only)
- (`--ci` flag) git tree is clean

The script source is `scripts/agents-check.mjs`. Keep it honest: when you add new doc conventions, teach the script to enforce them.
