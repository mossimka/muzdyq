# Muzdyq · Glacier

[English](../README.md) · [Русский](README.ru.md) · [Қазақша](README.kk.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · **Français** · [Deutsch](README.de.md) · [Português (BR)](README.pt-BR.md)

**Archive photo ouverte de science citoyenne pour les glaciers et les plans d'eau
de la chaîne d'Ile Alatau (Zailiysky Alatau), au Kazakhstan — sans compte, sans
suivi de localisation et sans analytique.**

Muzdyq (mot kazakh pour « glacier ») permet à toute personne sur un sentier balisé
de prendre une photo reproductible depuis un point de vue fixe. Au fil des années,
ces photos forment un registre visuel public et comparable du recul des glaciers et
de l'évolution des lacs de montagne.

- **Application web :** React 19 + TypeScript + Vite PWA, Ant Design, MapLibre GL,
  kazakh / russe / anglais.
- **API :** FastAPI + SQLAlchemy 2 + PostgreSQL/PostGIS (SQLite en développement).
- **Données ouvertes :** export CSV, GeoJSON, JSON et ZIP sous **CC BY 4.0**.
- **Code :** **MIT**.

> [!IMPORTANT]
> Les 7 points de suivi fournis utilisent des **coordonnées approximatives et non
> vérifiées** (`coords_verified: false`). Elles doivent être contrôlées sur le
> terrain et avec des glaciologues avant toute mise en ligne publique. Voir
> [`backend/seed/points.json`](../backend/seed/points.json) et
> [`ETHICS.md`](ETHICS.md).
>
> **Les photos citoyennes sont des observations, pas des mesures.** Elles ne
> remplacent ni le bilan de masse glaciaire, ni les relevés topographiques, ni le
> travail des stations scientifiques.

---

## Démarrage rapide

### Option A — Docker Compose (recommandée)

Nécessite Docker Engine 24+ avec le plugin Compose. À exécuter depuis la racine du
dépôt :

```bash
cp .env.example .env
docker compose up --build
```

Ouvrez **<http://localhost:8080>**. Le premier démarrage prend environ 15 à 30
secondes : le backend applique les migrations, charge 7 points et 8 points de vue,
puis génère 35 photos de démonstration synthétiques clairement étiquetées.

| Adresse | Usage |
| --- | --- |
| <http://localhost:8080> | PWA : carte, galerie, prise de vue, exports |
| <http://localhost:8080/docs> | Documentation OpenAPI interactive |
| <http://localhost:8000/api/health> | État de l'API en direct |
| <http://localhost:8080/api/export/photos.geojson> | Export de données ouvertes |

Pour arrêter : `docker compose down`. L'option `-v` supprime aussi les volumes de
base de données et de médias.

### Option B — développement local

Backend (Python 3.12+) :

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

L'API écoute sur <http://127.0.0.1:8000>, avec SQLite
(`backend/data/muzdyq.db`) et un répertoire média local ; les données de
démonstration sont créées au démarrage.

Frontend (Node 22+) :

```bash
cd frontend
npm ci
npm run dev
```

Ouvrez <http://127.0.0.1:5173>. Vite relaie `/api`, `/media`, `/docs` et
`/openapi.json` vers le backend : aucune configuration CORS ni clé API n'est
nécessaire.

---

## Fonctionnalités

### Carte et panneau de point
- Carte raster MapLibre (OpenStreetMap ; OpenTopoMap en mode détaillé) avec
  marqueurs de glaciers et de plans d'eau.
- Panneau latéral sur ordinateur et panneau inférieur sur mobile : description,
  consignes de sécurité, coordonnées, altitude et avertissement sur les données
  non vérifiées.
- Sélection du point de vue, photo de référence et lien QR pour les panneaux sur
  le sentier.
- Filtre par année, comparateur avant/après, timelapse côté client et galerie.
- Téléchargements CSV, GeoJSON, JSON et ZIP par point et pour toute l'archive.

### Prise de vue (`/p/:slug/:viewpointId`)
- Caméra arrière si disponible, sinon sélection de fichier.
- **Calque de référence** semi-transparent avec opacité réglable.
- Étiquettes facultatives : météo, visibilité, couverture neigeuse.
- Redimensionnement sur l'appareil (~1600 px, JPEG 0.75), suppression des
  EXIF/GPS, pixelisation des visages dans le navigateur et vignette.
- File d'attente d'envoi dans IndexedDB, UUID idempotent, temporisation
  exponentielle, nouvel essai manuel et Background Sync lorsque pris en charge.
- Mode vert activé par défaut : tuiles légères, pas de lecture automatique,
  téléchargement d'une zone pour le hors-ligne et aucune analytique.

### Backend
- Envois anonymes, sans comptes ni identité du contributeur.
- Validation MIME et de taille côté serveur, suppression des EXIF, floutage des
  visages (OpenCV YuNet, repli Haar), vignettes, empreinte perceptuelle pour
  détecter les doublons, `taken_at` arrondi à l'heure et limitation par
  empreinte d'IP/appareil.
- Modération via `X-Admin-Token` ; l'interface n'utilise pas ces points d'accès.
- Les exports incluent les métadonnées, les coordonnées, la licence et
  l'avertissement scientifique.

### Langues et accessibilité
- Interfaces en kazakh, russe et anglais ; le sélecteur reste toujours visible.
- Thème sombre, navigation au clavier, lien d'évitement et contraste visant
  WCAG ; mise en page vérifiée à 360 px de large.

---

## Aperçu de l'API

Les points d'accès publics ne demandent aucune authentification.

| Méthode | Chemin | Usage |
| --- | --- | --- |
| `GET` | `/api/points` | Tous les points, points de vue et nombre de photos |
| `GET` | `/api/points/{slug}` | Un point |
| `GET` | `/api/points/{slug}/photos` | Photos publiées ; `year`, `from`, `to`, `cursor` |
| `POST` | `/api/points/{slug}/photos` | Envoi anonyme ; `client_uuid` rend les reprises sûres |
| `GET` | `/api/export/photos.csv` | Métadonnées CSV |
| `GET` | `/api/export/photos.geojson` | GeoJSON |
| `GET` | `/api/export/photos.json` | Jeu JSON avec licence |
| `GET` | `/api/export/photos.zip` | Images + métadonnées + licence |
| `GET` | `/api/health` | État du service, de la base et du stockage |
| `GET` | `/docs` | Swagger UI |

Référence complète : [`API.md`](API.md) et `/docs` sur le serveur.

Exemple d'envoi :

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
./venv/bin/pytest -q                 # 28 tests

# Frontend
cd frontend
npm run lint
npx tsc -b
npm test                             # 14 tests Vitest
npm run build
npm run e2e                          # Playwright, 3 profils
```

Les tests backend couvrent la suppression des EXIF, le floutage des visages,
l'idempotence des envois, les exports et la limitation de débit. Le test de file
d'attente vérifie les reprises et la réutilisation des UUID. Playwright utilise une
API simulée et ne nécessite pas de backend.

---

## Configuration

Copiez [`.env.example`](../.env.example) vers `.env`. Réglages principaux :

| Variable | Valeur par défaut | Usage |
| --- | --- | --- |
| `DATABASE_URL` | SQLite dans `backend/data/` | `postgresql+psycopg://…` avec Compose |
| `MEDIA_ROOT` | `./data/media` | Originaux et vignettes |
| `ADMIN_TOKEN` | valeur de développement | **À changer avant publication** |
| `IP_HASH_SALT` | valeur de développement | **À changer avant publication** |
| `SEED_DEMO` | `true` | Photos de démonstration synthétiques |
| `UPLOAD_LIMIT_PER_HOUR` | `40` | Limite par empreinte IP/appareil |
| `PUBLIC_BASE_URL` | vide | URL absolues dans les exports |

---

## Confidentialité et éthique

- Aucun compte, profil, note, classement, série ni badge.
- Les GPS et EXIF ne sont ni envoyés ni publiés : le client les supprime, puis le
  serveur les supprime à nouveau.
- Les visages sont floutés sur l'appareil lorsque possible et toujours sur le
  serveur.
- Aucune analytique tierce, aucun traceur, aucun cookie publicitaire.
- Les photos sont publiées sous **CC BY 4.0** ; la personne qui contribue doit
  détenir le droit de les partager.
- Les consignes de sécurité sont affichées sur chaque parcours de contribution. Ne
  quittez pas le sentier balisé et ne vous approchez pas d'un glacier, d'une
  moraine, de l'eau ou d'une pente enneigée pour une photo.

En savoir plus : [`ETHICS.md`](ETHICS.md) et la page « Éthique et confidentialité »
de l'application.

---

## Structure du dépôt

```
backend/      FastAPI, migrations, données de démonstration, tests
frontend/     React + TypeScript PWA, service worker, e2e
docs/         architecture, API, éthique, licence, hors-ligne, DPG
deploy/       exemple nginx avec TLS
docker-compose.yml
.env.example
```

---

## Documentation

- [Architecture](ARCHITECTURE.md)
- [API](API.md)
- [Liste Digital Public Good](DPG_CHECKLIST.md)
- [Éthique et confidentialité](ETHICS.md)
- [Licence des données](DATA_LICENSE.md)
- [Hors-ligne et mode vert](OFFLINE.md)
- [Guide de contribution](../CONTRIBUTING.md)

---

## Licence

- **Code :** MIT — voir [`LICENSE`](../LICENSE).
- **Photos et métadonnées :** CC BY 4.0 — voir [`DATA_LICENSE.md`](DATA_LICENSE.md).
- **Tuiles cartographiques :** © contributeurs OpenStreetMap (ODbL) ;
  OpenTopoMap (CC BY-SA).
- Les images de démonstration sont synthétiques et ne représentent pas des
  observations réelles.

Muzdyq s'inscrit dans l'**ODD 13 (lutte contre le changement climatique)**,
l'**ODD 6.6 (écosystèmes aquatiques)** et les principes des biens publics
numériques : licence ouverte, données ouvertes, confidentialité par défaut et
absence de dépendance à un fournisseur.

---

*Cette traduction couvre l'essentiel ; le [README anglais](../README.md) fait
référence. En cas de divergence, le texte anglais prévaut.*
