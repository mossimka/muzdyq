/* Muzdyq service worker — offline shell, read-only API cache, map tiles.
 * Uploads are handled by the page (IndexedDB queue), never cached here.
 */
const VERSION = 'muzdyq-v2'
const SHELL_CACHE = `muzdyq-shell-${VERSION}`
const RUNTIME_CACHE = `muzdyq-runtime-${VERSION}`
const API_CACHE = `muzdyq-api-${VERSION}`
const MEDIA_CACHE = `muzdyq-media-${VERSION}`
const TILE_CACHE = 'muzdyq-tiles-v1'
const KEEP_CACHES = new Set([SHELL_CACHE, RUNTIME_CACHE, API_CACHE, MEDIA_CACHE, TILE_CACHE])
const TILE_HOSTS = new Set([
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
  'tile.opentopomap.org',
  'a.tile.opentopomap.org',
  'b.tile.opentopomap.org',
  'c.tile.opentopomap.org',
])

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Precache the shell and the point catalogue so a first-visit reload is
      // useful offline. The catalogue goes into the API cache because that is
      // where networkFirst() looks it up. Individual point fetches refresh it
      // once the worker controls the page.
      const [shell, api] = await Promise.all([
        caches.open(SHELL_CACHE),
        caches.open(API_CACHE),
      ])
      await Promise.allSettled([shell.add('/'), api.add('/api/points')])
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => !KEEP_CACHES.has(name)).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  for (const key of keys.slice(0, keys.length - maxEntries)) {
    await cache.delete(key)
  }
}

async function networkFirst(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: Boolean(options.ignoreSearch) })
    if (cached) return cached
    if (request.mode === 'navigate') {
      const shell = await cache.match('/')
      if (shell) return shell
    }
    throw error
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
    if (maxEntries) await trimCache(cache, maxEntries)
  }
  return response
}

function isMediaRequest(url) {
  return (
    /^\/api\/photos\/[^/]+\/(file|thumb)$/.test(url.pathname) ||
    /^\/api\/viewpoints\/[^/]+\/reference$/.test(url.pathname)
  )
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (TILE_HOSTS.has(url.hostname)) {
    event.respondWith(cacheFirst(request, TILE_CACHE, 1600))
    return
  }

  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE))
    return
  }

  if (url.pathname.startsWith('/api/export/')) return

  if (isMediaRequest(url)) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE, 900))
    return
  }

  if (url.pathname === '/api/points' || url.pathname.startsWith('/api/points/')) {
    event.respondWith(networkFirst(request, API_CACHE, { ignoreSearch: false }))
    return
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.svg'
  ) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE, 400))
  }
})

self.addEventListener('sync', (event) => {
  if (event.tag !== 'muzdyq-upload') return
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) client.postMessage({ type: 'muzdyq:sync' })
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})
