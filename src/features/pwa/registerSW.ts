/**
 * Register the service worker at module load. No-op in dev — the SW would
 * interfere with Vite HMR and stale-cache source files.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err)
    })
  })
}
