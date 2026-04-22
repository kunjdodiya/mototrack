import { platform } from '../platform'
import { pullFromCloud, syncUnsyncedRides } from './sync'

/**
 * Interval between background pulls while the app is foregrounded and the
 * user is still actively signed in. 90s is short enough that a ride recorded
 * on another device shows up "soon" while a rider is actively browsing
 * history, and long enough not to thrash the connection on a motorcycle where
 * data is expensive. Foreground-only: the interval is cleared whenever the
 * tab is hidden / the app is backgrounded.
 */
const FOREGROUND_PULL_MS = 90_000

/**
 * Keep Dexie in step with Supabase across devices after sign-in completes.
 *
 * The initial `syncWithCloud()` in AuthGate handles the first reconciliation.
 * After that, sync is triggered whenever there is reason to believe the
 * server may have newer rows:
 *
 *   • `document.visibilitychange` → visible (web + Capacitor WebView)
 *   • `window.focus` (belt-and-braces on desktop browsers that sometimes
 *     don't emit visibilitychange when the tab is already visible but gains
 *     focus from another window)
 *   • `platform.onAppResume` (native iOS/Android, when the user returns from
 *     the home screen / app switcher)
 *   • a foreground interval (FOREGROUND_PULL_MS) as the catch-all for the
 *     "both apps open at once" edge case, so a rider finishing a ride on
 *     device B still sees it land on an already-open device A without
 *     having to leave and re-open.
 *
 * Pulls are read-only; pushes happen at ride-save time and in
 * `syncWithCloud()` on sign-in. If a pending local write hasn't made it up
 * yet (app was offline at Stop), the foreground tick also runs
 * `syncUnsyncedRides()` so it retries.
 *
 * Returns an unsubscribe fn — call it on sign-out so an incoming user on
 * the same device doesn't receive stale pulls scoped to the previous
 * session.
 */
export function startLiveSync(): () => void {
  let cancelled = false
  let pullInFlight = false
  let intervalId: ReturnType<typeof setInterval> | null = null

  const pull = async () => {
    if (cancelled || pullInFlight) return
    pullInFlight = true
    try {
      // Retry any rides/bikes/trips that failed to upload earlier (network
      // came back, app woken from background, etc.), then pull anything the
      // server has that we don't.
      await syncUnsyncedRides()
      await pullFromCloud()
    } catch {
      // Swallow — sync is best-effort. RLS + Dexie tolerate a missed tick.
    } finally {
      pullInFlight = false
    }
  }

  const startInterval = () => {
    if (intervalId != null) return
    intervalId = setInterval(() => {
      void pull()
    }, FOREGROUND_PULL_MS)
  }
  const stopInterval = () => {
    if (intervalId == null) return
    clearInterval(intervalId)
    intervalId = null
  }

  const onVisibility = () => {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'visible') {
      void pull()
      startInterval()
    } else {
      stopInterval()
    }
  }

  const onFocus = () => {
    void pull()
  }

  const unsubscribeResume = platform.onAppResume(() => {
    void pull()
    startInterval()
  })

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onFocus)
  }

  // Start the interval immediately; if the app happens to launch hidden,
  // the next visibilitychange will clear and re-arm it.
  startInterval()

  return () => {
    cancelled = true
    stopInterval()
    unsubscribeResume()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onFocus)
    }
  }
}
