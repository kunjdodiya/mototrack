/**
 * Request a screen wake lock, re-acquiring it when the page becomes visible
 * again (the browser drops it automatically on tab blur).
 *
 * NOTE: Wake Lock prevents the screen from dimming while the app is
 * foreground — it does NOT prevent the user locking the device. On iOS Safari
 * this means v1 requires screen-on. Capacitor native geolocation is the real
 * fix.
 *
 * Returns a release function.
 */
export async function requestWakeLock(): Promise<() => void> {
  // `wakeLock` is not on the TS lib.dom for all TS versions; cast narrowly.
  const nav = navigator as Navigator & {
    wakeLock?: {
      request(type: 'screen'): Promise<WakeLockSentinelLike>
    }
  }

  if (!nav.wakeLock) {
    return () => {} // silent no-op on unsupported browsers
  }

  let sentinel: WakeLockSentinelLike | null = null
  let released = false

  const acquire = async () => {
    if (released) return
    try {
      sentinel = await nav.wakeLock!.request('screen')
    } catch {
      // User rejected, battery saver on, etc. — swallow and leave sentinel null.
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible' && !sentinel) {
      void acquire()
    }
  }

  await acquire()
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    released = true
    document.removeEventListener('visibilitychange', onVisibility)
    if (sentinel) {
      void sentinel.release()
      sentinel = null
    }
  }
}

type WakeLockSentinelLike = {
  release(): Promise<void>
}
