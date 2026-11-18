# Muzdyq frontend

React 19 + TypeScript + Vite 8 PWA for the Muzdyq glacier photo archive.
Ant Design for controls, Tailwind v4 for layout, MapLibre GL for the map,
react-i18next for Kazakh/Russian/English.

See the [repository README](../README.md) for the project overview and the
[offline guide](../docs/OFFLINE.md) for caching behaviour.

## Development

```bash
npm ci
npm run dev        # http://127.0.0.1:5173, proxies /api to :8000
```

Start the backend first (`cd ../backend && ./venv/bin/uvicorn app.main:app --reload`).

## Checks

```bash
npm run lint       # ESLint
npx tsc -b         # strict TypeScript
npm test           # Vitest + jsdom + fake-indexeddb
npm run build      # production bundle in dist/
npm run e2e        # Playwright smoke test (mocked API)
```

Install the Playwright browser once:

```bash
npx playwright install chromium
```

## Production

`npm run build` emits a static PWA in `dist/`. It expects the API and docs to be
available on the same origin:

- `/api/*`
- `/docs`, `/redoc`, `/openapi.json`

The nginx config in this directory does that and is used by the Docker image:

```bash
docker build -t muzdyq-frontend .
```

## Structure

```
src/
├── components/   AppShell, MapView, PointPanel, gallery, compare, timelapse
├── context/      persisted language / theme / Green mode
├── i18n/         en.json, ru.json, kk.json + parity test
├── lib/          api, image pipeline, IndexedDB queue, sync, tiles, PWA
├── pages/        Home, About, Data, Ethics, Contribute, Capture, Queue, 404
└── test/         Vitest setup
public/
├── sw.js         offline shell, API/media/tile caches
├── manifest.webmanifest
└── icons/
e2e/              Playwright smoke test
```

## Notes

- MapLibre v6 ships its worker separately. `MapView.tsx` imports it with
  `?url` and calls `setWorkerUrl()`; do not remove this, or the map will fail in
  dev and in production.
- The service worker is registered only in production builds.
- EXIF stripping and resizing happen in `src/lib/image.ts`; never upload the
  original camera file.
- The upload queue is in `src/lib/queue.ts`; retry/backoff is in
  `src/lib/sync.ts`. Keep retries on the same `client_uuid`.
- Add new strings to all three locale files; `npm test` enforces key parity.
- Do not add analytics, accounts, location tracking or gamification. See
  [`CONTRIBUTING.md`](../CONTRIBUTING.md).
