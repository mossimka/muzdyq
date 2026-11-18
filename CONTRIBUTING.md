# Contributing to Muzdyq

Thanks for helping build an open, account-free glacier photo archive. This guide
covers the development workflow, the rules that are not negotiable, and how to
propose a new monitoring point.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Code is
MIT; contributed photos and metadata are CC BY 4.0.

---

## Good first issues

- Translate a missing string or improve a Kazakh/Russian wording.
- Add a test for an edge case in the upload or export API.
- Improve keyboard navigation or contrast.
- Document a deployment pattern or a field-work lesson.
- Propose a monitoring point with a source and a safe, legal viewpoint.

Please open an issue before starting a large change so we can agree on the
approach and avoid duplicate work.

---

## Development setup

### Backend (Python 3.12+)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

SQLite and a local media directory are used by default. The app seeds points,
viewpoints and synthetic demo photos on startup.

```bash
./venv/bin/ruff check app tests
./venv/bin/ruff format --check app tests   # optional if you use the formatter
./venv/bin/pytest -q
```

### Frontend (Node 22+)

```bash
cd frontend
npm ci
npm run dev
```

```bash
npm run lint
npx tsc -b
npm test
npm run build
npm run e2e
```

Playwright's smoke test mocks the API and needs no backend. Install the browser
once with `npx playwright install chromium`.

### Docker

```bash
cp .env.example .env
docker compose up --build
```

---

## Pull request checklist

- [ ] The change is focused and described in the PR template.
- [ ] Tests cover new behaviour (or explain why no test is possible).
- [ ] `ruff check`, `pytest`, `npm run lint`, `tsc -b`, `npm test` and
      `npm run build` pass locally.
- [ ] User-visible strings exist in **en, ru and kk** (`npm test` enforces key
      parity and non-empty values).
- [ ] No analytics, trackers, third-party cookies, accounts, GPS collection,
      leaderboards, streaks or badges were introduced.
- [ ] New images are licensed for reuse and contain no identifiable people
      without consent.
- [ ] Documentation is updated (`README.md`, `docs/*`, `.env.example`).
- [ ] No secrets, API keys or real personal data are committed.

CI runs the same checks. A maintainer reviews every PR; moderation and point
changes additionally need domain review.

---

## Non-negotiable product rules

Muzdyq is deliberately small and restrained. PRs that violate these will be
declined regardless of quality:

1. **No accounts, profiles or identity.** No email/password, OAuth, phone login,
   contributor names or avatars.
2. **No gamification.** No points, badges, streaks, leaderboards, rankings,
   “missions”, unlocks or social sharing pressure.
3. **No location tracking.** No GPS permission, background location, geofencing
   or contributor heatmaps. Photos belong to fixed viewpoints.
4. **No analytics or ad tech.** No Google Analytics, pixels, fingerprinting,
   session replay or third-party cookies. Operational logs stay operational.
5. **No metadata leaks.** EXIF/GPS must be stripped on device **and** on the
   server. Timestamps are coarsened to the hour.
6. **Safety over engagement.** Never encourage users to leave trails, approach
   ice/water or visit in dangerous conditions.
7. **Scientific honesty.** Photos are observations, not measurements. Keep the
   disclaimer visible and `is_demo` labels intact.
8. **Accessibility and language parity.** New UI must work at 360 px, with
   keyboard and screen readers, in all three languages.

If a feature needs an exception, open a design discussion first and document the
privacy impact in `docs/ETHICS.md`.

---

## Adding a monitoring point

1. Edit [`backend/seed/points.json`](backend/seed/points.json). The schema is
   enforced by the seed loader; keep entries deterministic.
2. Required fields: `slug`, `type` (`glacier` or `water`), `name_i18n`,
   `description_i18n`, `safety_note_i18n` (en/ru/kk), `lat`, `lon`,
   `coords_verified`, `viewpoints`.
3. Each viewpoint needs a stable `id`, a `heading_deg`, a `note_i18n`, and
   ideally a `reference_photo` path.
4. **Leave `coords_verified: false`** until a field visit and a glaciologist have
   confirmed the coordinates, stand location and heading. Explain the source of
   the coordinates in the PR.
5. The viewpoint must be reachable on a marked trail, outside closed zones and
   away from glacier termini, moraine crests, water edges and steep snow.
6. Write safety notes that are specific to the place, not generic.
7. Run the backend and verify the point appears on the map, opens the panel and
   returns photos/exports correctly.

Do not add a point because it is photogenic. Add it because it is safe,
repeatable and scientifically useful.

---

## Adding a language

1. Copy `frontend/src/i18n/locales/en.json` to `<code>.json` and translate every
   value. Do not change keys or structure.
2. Add the locale to `SUPPORTED_LOCALES` and the resources map in
   `frontend/src/i18n/index.ts`.
3. Add an Ant Design locale in `frontend/src/App.tsx` if one exists.
4. Add the language to the switcher in `AppShell.tsx`.
5. Run `npm test` — key parity and non-empty checks must pass.
6. If a right-to-left language is added, audit layout direction explicitly.

---

## Photography and content contributions

- Only upload photos you took or have the right to license under CC BY 4.0.
- Do not photograph identifiable people without consent; blur or avoid them.
- No children as subjects, no private homes/vehicles/plates, no drones, no
  wildlife disturbance, no cultural sites staged for photos.
- Demo/synthetic imagery must stay clearly labelled and marked `is_demo`.

Report privacy or safety concerns privately as described in
[SECURITY.md](SECURITY.md); do not open a public issue containing personal data.

---

## Commit and review style

- Imperative, scoped commit subjects: `api: reject unsupported WebP variants`.
- Keep refactors separate from behaviour changes.
- Explain *why* in the PR description, especially for security or privacy code.
- Be kind in review. Assume good intent and ask questions before asserting.

Maintainers may be slow; this is a volunteer, safety-sensitive project. A polite
ping after a week is welcome.
