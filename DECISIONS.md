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
