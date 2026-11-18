# Digital Public Good checklist

This checklist maps Muzdyq against the **Digital Public Goods Standard** (DPGA,
9 indicators) and the **UN Sustainable Development Goals**. It is intentionally
honest: a checkbox marked *Partial* or *Gap* is not a failure, it is work that
must be done before the project can claim to be a deployed DPG.

Legend: **Met** · **Partial** · **Gap** · **N/A**

---

## 1. Relevance to the SDGs

| Goal / target | How Muzdyq contributes | Status |
| --- | --- | --- |
| **SDG 13** Climate action | Long-term visual evidence of glacier and lake change; open data for education and advocacy | Met |
| **SDG 13.3** Climate knowledge | Public, multilingual archive and school-friendly comparison tools | Met |
| **SDG 6.6** Water-related ecosystems | Repeat photography of glacier-fed lakes and streams in the Ile Alatau | Met |
| **SDG 4.7** Education for sustainable development | Free data, ethics documentation, classroom-ready exports | Met |
| **SDG 9.c / 17.6** Technology access and knowledge cooperation | Runs on low-end phones, free/open stack, kk/ru/en, offline-first | Met |
| **SDG 10** Reduced inequalities | No account, no payment, no app store, works offline and in three languages | Met |

Primary alignment: **SDG 13 (Climate Action)** and **SDG 6.6 (water-related
ecosystems)**.

---

## 2. Open licence

| Requirement | Evidence | Status |
| --- | --- | --- |
| Code under an OSI-approved licence | MIT — [`LICENSE`](../LICENSE) | Met |
| Content/data under an open licence | CC BY 4.0 — [`docs/DATA_LICENSE.md`](DATA_LICENSE.md) | Met |
| Licence visible in the application | Footer, data page, point panel, exports | Met |
| Exports carry licence metadata | `X-Data-License`, `Link: rel="license"`, ZIP licence file | Met |
| No licence conflict in dependencies | MIT/BSD/Apache-2.0 dependencies; map tiles keep their own licences | Met |

---

## 3. Clear ownership

| Requirement | Evidence | Status |
| --- | --- | --- |
| Named owner or steward | Maintainers listed in [`CONTRIBUTING.md`](../CONTRIBUTING.md); repository owner acts as interim steward | Partial |
| Legal entity or foundation able to hold rights | Not established | Gap |
| Public contact and governance model | Issue tracker, `SECURITY.md`, moderation policy in [`docs/ETHICS.md`](ETHICS.md) | Partial |
| Trademark and name policy | Name/logo not registered; usage guidance in `DATA_LICENSE.md` | Partial |

**Before launch:** name a legal owner (university, NGO or foundation), publish a
governance page, and define who can approve new points and moderate photos.

---

## 4. Platform independence

| Requirement | Evidence | Status |
| --- | --- | --- |
| No proprietary runtime or cloud lock-in | Python/FastAPI, PostgreSQL/PostGIS, nginx, React; optional S3-compatible storage | Met |
| Runs on a single modest server | `docker compose up` with 3 containers | Met |
| Data portability | CSV, GeoJSON, JSON, ZIP; plain files on disk/S3 | Met |
| No vendor SDKs in the client | No Google/Meta/analytics SDKs | Met |
| Documented alternative deployment | Local dev + Compose + TLS reverse proxy example | Met |

---

## 5. Documentation

| Requirement | Evidence | Status |
| --- | --- | --- |
| User documentation | [`README.md`](../README.md), in-app About/Data/Ethics pages | Met |
| Administrator documentation | README configuration table, [`docs/ARCHITECTURE.md`](ARCHITECTURE.md), `.env.example` | Met |
| API documentation | [`docs/API.md`](API.md) and live OpenAPI at `/docs` | Met |
| Contribution guide | [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Met |
| Offline and field guidance | [`docs/OFFLINE.md`](OFFLINE.md), in-app safety notes | Met |
| Accessibility statement | [`docs/ETHICS.md`](ETHICS.md) §6 | Partial — no formal WCAG audit |
| Localisation guide | i18n key-parity test and locale files; CONTRIBUTING describes adding a language | Met |

---

## 6. Mechanism for extracting data

| Requirement | Evidence | Status |
| --- | --- | --- |
| Bulk export without authentication | `/api/export/photos.{csv,geojson,json,zip}` | Met |
| Machine-readable format | CSV, GeoJSON (`FeatureCollection`), JSON | Met |
| Stable identifiers | `photo_id` UUID, `point_slug`, `viewpoint_id` | Met |
| Metadata preserved | Time, point, viewpoint, tags, dimensions, licence, `is_demo` | Met |
| Incremental use | Date filters (`from`, `to`) and point filter | Met |
| API access without accounts | Public read endpoints | Met |
| Long-term archive plan | Not yet defined (no institutional repository or DOI) | Gap |

**Before launch:** deposit exports in a national/institutional repository, mint a
DOI per release, and publish a retention policy.

---

## 7. Privacy and applicable laws

| Requirement | Evidence | Status |
| --- | --- | --- |
| Data minimisation | No accounts, no GPS, no EXIF, hourly timestamps | Met |
| Purpose limitation | Photos used only for the public archive and exports | Met |
| Consent | Upload confirms CC BY 4.0 and consent for identifiable people | Met |
| Privacy policy | In-app Ethics & privacy page; [`docs/ETHICS.md`](ETHICS.md) | Met |
| Deletion/takedown path | Contact address; admin hide/delete; no account needed | Partial — no self-service form |
| Formal legal review (Kazakhstan, GDPR where relevant) | Not performed | Gap |
| Data protection impact assessment | Not performed | Gap |
| Children's data | UI prohibits photographing minors; no age collection | Partial |

**Before launch:** complete a DPIA, name a data controller, publish a lawful basis
and retention schedule, and document the cross-border hosting location.

---

## 8. Adherence to standards and best practices

| Requirement | Evidence | Status |
| --- | --- | --- |
| OpenAPI specification | FastAPI `/openapi.json` | Met |
| Semantic versioning | `0.1.0`; releases tagged in CI | Met |
| GeoJSON / RFC 7946 | Export endpoint | Met |
| OGC-style coordinates (WGS 84) | Point lat/lon; PostGIS view | Met |
| Web accessibility | WCAG 2.1 AA target, lint and manual checks | Partial — no external audit |
| Security headers | CSP-adjacent headers in app, nginx and API | Met |
| Automated tests | 28 backend, 14 frontend, Playwright smoke | Met |
| CI | `.github/workflows/ci.yml` | Met |
| Dependency and secret hygiene | `.gitignore`, `.env.example`, no secrets in repo | Met |
| Internationalisation | BCP 47 `en`, `ru`, `kk`; Ant Design locales | Met |

---

## 9. Do no harm by design

| Risk | Mitigation | Status |
| --- | --- | --- |
| Physical injury while photographing | Conservative viewpoints, safety notes on every contribution screen, no location challenges, 112 guidance | Met |
| Privacy of people in photos | On-device and server-side face blur, consent rules, moderation, takedown | Partial — best-effort blur |
| Re-identification via metadata | EXIF stripped, hourly timestamps, no accounts, salted hashes | Met |
| Surveillance / tracking | No analytics, no GPS, no third-party cookies, no push pressure | Met |
| Ecological damage | Trail-only guidance, no drones, no wildlife baiting | Met |
| Misinterpretation as science | Disclaimer on home, panel, data page and exports; demo labels | Met |
| Exclusion | Offline-first, 360 px support, three languages, no payment/account | Met |
| Harassment or brigading | No comments, no profiles, no ratings, moderation | Met |
| Security abuse | MIME validation, size limits, rate limits, idempotency, admin token | Partial — in-process limiter, no external audit |

---

## SDG and DPG summary

| Dimension | Current state |
| --- | --- |
| Open licence | ✅ MIT (code) + CC BY 4.0 (data) |
| Open data | ✅ Four export formats, public API |
| Privacy by design | ✅ No accounts/GPS/analytics; ⚠️ no formal DPIA |
| Do no harm | ✅ Safety-first UX; ⚠️ best-effort face blur |
| Reusability | ✅ Compose, docs, seed data, tests |
| Ownership | ⚠️ interim maintainers, no legal entity |
| Long-term preservation | ❌ no repository/DOI yet |
| Accessibility | ⚠️ WCAG target, no external audit |

Muzdyq is **DPG-ready in design**, not yet DPG-registered. The remaining blockers
are governance, legal review, field verification of points, a preservation plan
and an accessibility/security audit — all tracked in the repository.

---

## How to verify the claims

```bash
# Licences
head -5 LICENSE
grep -R "CC-BY-4.0" backend/app/api/export.py

# Public data extraction
curl -s http://localhost:8080/api/export/photos.json | jq '.license, .disclaimer'
curl -s http://localhost:8080/api/export/photos.geojson | jq '.features | length'

# No accounts in the schema
grep -n "class " backend/app/models.py

# No analytics/trackers in the client
grep -rEi "analytics|gtag|facebook|sentry" frontend/src frontend/public || echo "none"

# Tests
cd backend && ./venv/bin/pytest -q
cd frontend && npm test && npm run e2e
```
