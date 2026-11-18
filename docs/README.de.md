# Muzdyq · Gletscher

[English](../README.md) · [Русский](README.ru.md) · [Қазақша](README.kk.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [Français](README.fr.md) · **Deutsch** · [Português (BR)](README.pt-BR.md)

**Offenes Citizen-Science-Fotoarchiv für die Gletscher und Gewässer des
Ile-Alatau (Transili-Alatau) in Kasachstan — ohne Konten, ohne
Standortverfolgung und ohne Analyse-Tracking.**

Muzdyq (kasachisch für „Gletscher“) ermöglicht es jeder Person auf einem
markierten Wanderweg, ein wiederholbares Foto von einem festen Standpunkt
aufzunehmen. Über die Jahre entsteht so ein öffentliches, vergleichbares
visuelles Archiv des Gletscherschwunds und der Veränderung von Bergseen.

- **Web-App:** React 19 + TypeScript + Vite PWA, Ant Design, MapLibre GL,
  Kasachisch / Russisch / Englisch.
- **API:** FastAPI + SQLAlchemy 2 + PostgreSQL/PostGIS (SQLite für die
  Entwicklung).
- **Offene Daten:** Export als CSV, GeoJSON, JSON und ZIP unter **CC BY 4.0**.
- **Code:** **MIT**.

> [!IMPORTANT]
> Die 7 mitgelieferten Beobachtungspunkte verwenden **ungefähre und ungeprüfte
> Koordinaten** (`coords_verified: false`). Sie müssen vor einer öffentlichen
> Veröffentlichung im Gelände und mit Glaziologinnen und Glaziologen geprüft
> werden. Siehe [`backend/seed/points.json`](../backend/seed/points.json) und
> [`ETHICS.md`](ETHICS.md).
>
> **Fotos von Bürgerinnen und Bürgern sind Beobachtungen, keine Messungen.** Sie
> ersetzen weder die Gletschermassenbilanz noch geodätische Vermessungen oder die
> Arbeit wissenschaftlicher Stationen.

---

## Schnellstart

### Variante A — Docker Compose (empfohlen)

Erfordert Docker Engine 24+ mit Compose-Plugin. Aus dem Repository-Stamm
ausführen:

```bash
cp .env.example .env
docker compose up --build
```

Öffne **<http://localhost:8080>**. Der erste Start dauert etwa 15–30 Sekunden:
Das Backend führt Migrationen aus, lädt 7 Punkte und 8 Kamerastandpunkte und
erzeugt 35 klar gekennzeichnete synthetische Demofotos.

| Adresse | Zweck |
| --- | --- |
| <http://localhost:8080> | PWA: Karte, Galerie, Aufnahme, Exporte |
| <http://localhost:8080/docs> | Interaktive OpenAPI-Dokumentation |
| <http://localhost:8000/api/health> | API-Status direkt |
| <http://localhost:8080/api/export/photos.geojson> | Export offener Daten |

Zum Beenden: `docker compose down`. Mit `-v` werden auch Datenbank- und
Medien-Volumes gelöscht.

### Variante B — lokale Entwicklung

Backend (Python 3.12+):

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

Die API läuft unter <http://127.0.0.1:8000> und nutzt SQLite
(`backend/data/muzdyq.db`) sowie ein lokales Medienverzeichnis; die Demodaten
werden beim Start erzeugt.

Frontend (Node 22+):

```bash
cd frontend
npm ci
npm run dev
```

Öffne <http://127.0.0.1:5173>. Vite leitet `/api`, `/media`, `/docs` und
`/openapi.json` an das Backend weiter, daher sind weder CORS noch API-Schlüssel
nötig.

---

## Funktionen

### Karte und Punkt-Panel
- MapLibre-Rasterkarte (OpenStreetMap; OpenTopoMap im Detailmodus) mit Markern
  für Gletscher und Gewässer.
- Seitenpanel am Desktop und unteres Panel auf dem Smartphone: Beschreibung,
  Sicherheitshinweise, Koordinaten, Höhe und Warnung zu ungeprüften Daten.
- Auswahl des Kamerastandpunkts, Referenzfoto und QR-Link für Schilder am Weg.
- Jahresfilter, Vorher/Nachher-Vergleich, Timelapse im Browser und Galerie.
- Downloads als CSV, GeoJSON, JSON und ZIP pro Punkt und für das gesamte Archiv.

### Aufnahme (`/p/:slug/:viewpointId`)
- Rückkamera, falls verfügbar, sonst Dateiauswahl.
- Halbtransparente **Referenzüberlagerung** mit einstellbarer Deckkraft.
- Optionale Angaben zu Wetter, Sicht und Schneebedeckung.
- Verkleinerung auf dem Gerät (~1600 px, JPEG 0.75), Entfernen von EXIF/GPS,
  Pixelung von Gesichtern im Browser und Vorschaubild.
- Upload-Warteschlange in IndexedDB, idempotente UUID, exponentielles Warten,
  manueller erneuter Versuch und Background Sync, wo unterstützt.
- Grüner Modus standardmäßig aktiv: leichte Kartenkacheln, kein Autoplay,
  Offline-Download einer Kartenregion und keine Analyse.

### Backend
- Anonyme Uploads, keine Konten und keine Identität der Beitragenden.
- MIME- und Größenprüfung auf dem Server, EXIF-Entfernung, Gesichtsunschärfe
  (OpenCV YuNet, Haar als Rückfall), Vorschaubilder, perzeptueller Hash zur
  Duplikaterkennung, `taken_at` auf die Stunde gerundet und Ratenbegrenzung pro
  IP-/Geräte-Hash.
- Moderation über `X-Admin-Token`; die Oberfläche nutzt diese Endpunkte nicht.
- Exporte enthalten Metadaten, Koordinaten, Lizenz und den wissenschaftlichen
  Hinweis.

### Sprachen und Barrierefreiheit
- Oberflächen auf Kasachisch, Russisch und Englisch; die Sprachauswahl ist immer
  sichtbar.
- Dunkles Design, Tastaturnavigation, Skip-Link und WCAG-orientierter Kontrast;
  Layout bei 360 px Breite geprüft.

---

## API im Überblick

Öffentliche Endpunkte benötigen keine Authentifizierung.

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/api/points` | Alle Punkte, Standpunkte und Fotoanzahl |
| `GET` | `/api/points/{slug}` | Ein Punkt |
| `GET` | `/api/points/{slug}/photos` | Veröffentlichte Fotos; `year`, `from`, `to`, `cursor` |
| `POST` | `/api/points/{slug}/photos` | Anonymer Upload; `client_uuid` macht Wiederholungen sicher |
| `GET` | `/api/export/photos.csv` | Metadaten als CSV |
| `GET` | `/api/export/photos.geojson` | GeoJSON |
| `GET` | `/api/export/photos.json` | JSON-Datensatz mit Lizenz |
| `GET` | `/api/export/photos.zip` | Bilder + Metadaten + Lizenz |
| `GET` | `/api/health` | Status von Dienst, Datenbank und Speicher |
| `GET` | `/docs` | Swagger UI |

Vollständige Referenz: [`API.md`](API.md) und `/docs` auf dem laufenden Server.

Beispiel-Upload:

```bash
curl -X POST http://localhost:8080/api/points/tuyuksu-glacier/photos \
  -F "file=@photo.jpg" \
  -F "viewpoint_id=tuyuksu-glacier-v1" \
  -F "taken_at=2026-07-01T09:00:00Z" \
  -F "client_uuid=$(uuidgen)" \
  -F 'tags={"weather":"clear","snow_cover":"partial"}'
```

---

## Tests

```bash
# Backend
cd backend
./venv/bin/ruff check app tests
./venv/bin/pytest -q                 # 28 Tests

# Frontend
cd frontend
npm run lint
npx tsc -b
npm test                             # 14 Vitest-Tests
npm run build
npm run e2e                          # Playwright, 3 Profile
```

Die Backend-Tests prüfen EXIF-Entfernung, Gesichtsunschärfe, idempotente Uploads,
Exporte und Ratenbegrenzung. Der Warteschlangentest prüft Wiederholungen und die
Wiederverwendung von UUIDs. Playwright nutzt eine simulierte API und braucht kein
laufendes Backend.

---

## Konfiguration

Kopiere [`.env.example`](../.env.example) nach `.env`. Wichtigste Einstellungen:

| Variable | Standard | Zweck |
| --- | --- | --- |
| `DATABASE_URL` | SQLite in `backend/data/` | In Compose: `postgresql+psycopg://…` |
| `MEDIA_ROOT` | `./data/media` | Originale und Vorschaubilder |
| `ADMIN_TOKEN` | Entwicklungswert | **Vor Veröffentlichung ändern** |
| `IP_HASH_SALT` | Entwicklungswert | **Vor Veröffentlichung ändern** |
| `SEED_DEMO` | `true` | Synthetische Demofotos |
| `UPLOAD_LIMIT_PER_HOUR` | `40` | Limit pro IP-/Geräte-Hash |
| `PUBLIC_BASE_URL` | leer | Absolute URLs in Exporten |

---

## Datenschutz und Ethik

- Keine Konten, Profile, Bewertungen, Ranglisten, Serien oder Abzeichen.
- GPS und EXIF werden weder hochgeladen noch veröffentlicht: Der Client entfernt
  sie, der Server ein zweites Mal.
- Gesichter werden nach Möglichkeit auf dem Gerät und immer auf dem Server
  unscharf gemacht.
- Keine Analyse durch Dritte, keine Tracker, keine Werbe-Cookies.
- Fotos werden unter **CC BY 4.0** veröffentlicht; Beitragende bestätigen, dass
  sie zur Veröffentlichung berechtigt sind.
- Auf jedem Beitragsweg werden Sicherheitshinweise angezeigt. Verlasse für ein
  Foto nicht den markierten Weg und nähere dich nicht Gletschern, Moränen, Wasser
  oder steilem Schnee.

Mehr dazu: [`ETHICS.md`](ETHICS.md) und die Seite „Ethik und Datenschutz“ in der
App.

---

## Repository-Struktur

```
backend/      FastAPI, Migrationen, Seed-Daten, Tests
frontend/     React + TypeScript PWA, Service Worker, e2e
docs/         Architektur, API, Ethik, Lizenz, Offline, DPG
deploy/       nginx-Beispiel mit TLS
docker-compose.yml
.env.example
```

---

## Dokumentation

- [Architektur](ARCHITECTURE.md)
- [API](API.md)
- [Digital-Public-Good-Checkliste](DPG_CHECKLIST.md)
- [Ethik und Datenschutz](ETHICS.md)
- [Datenlizenz](DATA_LICENSE.md)
- [Offline und grüner Modus](OFFLINE.md)
- [Beitragsleitfaden](../CONTRIBUTING.md)

---

## Lizenz

- **Code:** MIT — siehe [`LICENSE`](../LICENSE).
- **Fotos und Metadaten:** CC BY 4.0 — siehe [`DATA_LICENSE.md`](DATA_LICENSE.md).
- **Kartenkacheln:** © OpenStreetMap-Mitwirkende (ODbL); OpenTopoMap (CC BY-SA).
- Demo-Bilder sind synthetisch und zeigen keine realen Beobachtungen.

Muzdyq orientiert sich an **SDG 13 (Klimaschutz)**, **SDG 6.6 (Wasserökosysteme)**
und den Prinzipien digitaler öffentlicher Güter: offene Lizenz, offene Daten,
Datenschutz by Design und keine Anbieterbindung.

---

*Diese Übersetzung deckt das Wesentliche ab; maßgeblich ist das
[englische README](../README.md). Bei Abweichungen gilt der englische Text.*
