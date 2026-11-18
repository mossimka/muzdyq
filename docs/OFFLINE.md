# Offline use and Green mode

Muzdyq is built for mountain trails where connectivity is unreliable. The
application shell, map tiles, point metadata and media can be cached; new photos
are queued locally and uploaded when the network returns.

Offline behaviour is **best-effort**. Browsers may evict caches under storage
pressure, and iOS has no Background Sync. Always carry a separate map, a power
bank and a way to call 112. Muzdyq is not a navigation or rescue tool.

---

## What works offline

| Feature | Offline behaviour |
| --- | --- |
| App shell and routes | Cached by the service worker after the first visit; unknown routes fall back to `/index.html` |
| Point list and point details | Cached after a successful load (`/api/points…`) |
| Photo lists and images | Previously viewed responses/images are cached (cache-first for media) |
| Map | Only tiles you have already viewed or explicitly downloaded |
| Capture | Fully client-side: camera/file, ghost overlay, resize, EXIF strip, face pixelation |
| Saving a photo | Written to IndexedDB; visible on **Upload queue** |
| Queue management | Retry, remove and inspect errors without a network |
| Exports | Require the network (never cached) |
| Language, theme, Green mode | Stored in `localStorage` |

Not cached by design: `/api/export/*`, uploads, admin endpoints, and anything
outside the tile hosts, same-origin `/api/points*`, media URLs and static assets.

---

## The upload queue

1. **Capture** (`/p/:slug/:viewpointId`) processes the image entirely on device.
2. `enqueuePhoto()` writes the JPEG + thumbnail + metadata to the IndexedDB
   database `muzdyq-offline`, object store `queue`.
3. The item gets a random UUID (`client_uuid`). Retries reuse it, so the server
   returns the original photo instead of creating a duplicate.
4. `syncQueue()` runs immediately, on `online`, when the tab becomes visible,
   every 30 s while open, and via Background Sync when the browser supports it.
5. On success the item is deleted. On failure it stays with `status: failed`,
   an error message and `nextAttemptAt`.

### Retry schedule

| Attempt | Delay |
| --- | --- |
| 1 | 5 s |
| 2 | 10 s |
| 3 | 20 s |
| 4 | 40 s |
| … | doubles |
| ≥ 12 | capped at 30 min |

The queue page lets the contributor **Retry now**, which ignores the scheduled
time and retries a single item. A 4xx error (for example an unsupported file) is
kept rather than discarded, so the contributor can decide whether to remove it.

### Storage and privacy

Queue items exist only in this browser profile. They are not synced to a cloud,
not visible to other tabs except through the `muzdyq:queue-changed` event, and
are removed after a successful upload. Clearing site data deletes unsent photos.

The queue page shows the number of items and their total size. The app does not
request persistent storage; browsers may evict the queue if the device is low on
space. Finish uploads before clearing browser data or uninstalling the PWA.

### Background Sync support

| Browser | In-page retry | Background Sync |
| --- | --- | --- |
| Chrome / Edge (Android, desktop) | Yes | Yes |
| Firefox | Yes | No |
| Safari / iOS | Yes, while the PWA is open | No |

When Background Sync is unavailable the page-level scheduler still retries while
the app is open; reopening the app triggers a sync.

---

## Map tiles and the offline region

The map is intentionally not preloaded wholesale. **Green mode (default on)**
uses lighter OpenStreetMap tiles and avoids autoplay or heavy layers. Detailed
mode switches to OpenTopoMap, which is slower and heavier.

On the home page, **Download offline map** prefetches tiles for the bounding box
of all points at zooms 10–13. The size estimate is shown before downloading; the
download is capped (see `frontend/src/lib/tiles.ts`) and progress is displayed.

What this gives you:

- a usable overview of the Ile Alatau and the seeded points;
- enough detail to orient at trailheads and junctions;
- caching of tiles you pan over while online.

What it does **not** give you:

- turn-by-turn navigation, trails, or relief shading at high zoom;
- guarantee against eviction (browser storage quotas apply);
- any offline availability for points you never opened.

Tile servers still see requests when you are online. Their terms apply:
© OpenStreetMap contributors (ODbL), © OpenTopoMap (CC BY-SA). Heavy automated
downloading is not permitted; the in-app limit is deliberately modest.

---

## Service worker caches

`frontend/public/sw.js` maintains:

| Cache | Strategy | Limit |
| --- | --- | --- |
| App shell | Network-first, fallback to `/` | — |
| Read API (`/api/points…`) | Network-first, cached fallback | — |
| Media (`/api/photos/*/file|thumb`, references) | Cache-first | ~900 entries |
| Map tiles | Cache-first | ~1600 entries |
| Static assets (`/assets`, icons, manifest) | Cache-first | ~400 entries |

Old caches are removed on activation. The worker is registered only in
production builds (`registerServiceWorker()` skips `import.meta.env.DEV`).

---

## Testing offline behaviour

1. Build and preview: `cd frontend && npm run build && npm run preview`.
2. Open the site once so the shell and points are cached.
3. In DevTools → Application → Service Workers, tick **Offline**, or stop the
   backend container.
4. Reload: the shell and cached points should still render.
5. Open a point with a cached gallery; previously viewed images should appear.
6. Use **Choose file** to add a photo; confirm it appears on `/queue` as pending.
7. Go back online; the queue should upload automatically. Or press **Sync now**.
8. Check `/api/health` counts and the point gallery for the new photo.

Automated coverage: `frontend/src/lib/queue.test.ts` exercises retry, backoff and
idempotent UUID reuse with `fake-indexeddb`. The Playwright smoke test mocks the
API and is not an offline test.

---

## Operational notes

- Serve over HTTPS (or `localhost`) — camera access and service workers require
  a secure context.
- Do not cache API mutations. Uploads bypass the service worker.
- Keep `sw.js` uncached at the reverse proxy (`Cache-Control: no-cache`), as the
  provided nginx config does.
- If you change cache names or strategies, bump `VERSION` in `sw.js` so clients
  discard old entries.
- Exports can be large; they are streamed and never queued for offline use.
