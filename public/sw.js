/* MotoTrack service worker — minimal hand-rolled (vite-plugin-pwa does not
 * yet support Vite 8). Two jobs:
 *   1. CacheFirst for OSM tiles during normal map viewing, so repeating a
 *      route or zoom level is instant on bad networks. NOT used for PNG
 *      export (which always fetches fresh to respect OSM policy).
 *   2. Offline shell: cache the built HTML/JS/CSS so the app opens without
 *      a network (users on rides in rural areas may have no signal).
 */

const SHELL_CACHE = 'mototrack-shell-v1'
const TILE_CACHE = 'mototrack-tiles-v1'
const TILE_CACHE_MAX_ENTRIES = 200

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.add('/')),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== TILE_CACHE)
          .map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // OSM tiles — CacheFirst.
  if (url.host === 'tile.openstreetmap.org') {
    event.respondWith(cacheFirst(TILE_CACHE, req))
    return
  }

  // Same-origin navigations — NetworkFirst with cached shell fallback.
  if (url.origin === self.location.origin && req.mode === 'navigate') {
    event.respondWith(networkFirst(SHELL_CACHE, req))
    return
  }

  // Everything else — let the network handle it.
})

async function cacheFirst(cacheName, req) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  if (hit) return hit
  try {
    const res = await fetch(req)
    if (res.ok) {
      cache.put(req, res.clone())
      void trimCache(cacheName, TILE_CACHE_MAX_ENTRIES)
    }
    return res
  } catch (err) {
    return new Response('offline', { status: 503 })
  }
}

async function networkFirst(cacheName, req) {
  try {
    const res = await fetch(req)
    if (res.ok) {
      const cache = await caches.open(cacheName)
      cache.put('/', res.clone())
    }
    return res
  } catch {
    const cache = await caches.open(cacheName)
    const cached = await cache.match('/')
    if (cached) return cached
    return new Response('offline', { status: 503 })
  }
}

async function trimCache(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  if (keys.length <= max) return
  const excess = keys.length - max
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i])
  }
}
