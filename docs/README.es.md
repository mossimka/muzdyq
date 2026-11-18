# Muzdyq · Glaciar

[English](../README.md) · [Русский](README.ru.md) · [Қазақша](README.kk.md) · [简体中文](README.zh-CN.md) · **Español** · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (BR)](README.pt-BR.md)

**Archivo fotográfico abierto de ciencia ciudadana para los glaciares y cuerpos
de agua de la cordillera de Ile Alatau (Zailiysky Alatau), Kazajistán — sin
cuentas, sin seguimiento de ubicación y sin analítica.**

Muzdyq (palabra kazaja para «glaciar») permite que cualquier persona en un sendero
señalizado aporte una foto repetible desde un punto de vista fijo. Con los años,
esas fotos forman un registro visual público y comparable de la retirada de los
glaciares y del cambio de los lagos de montaña.

- **Aplicación web:** React 19 + TypeScript + Vite PWA, Ant Design, MapLibre GL,
  kazajo / ruso / inglés.
- **API:** FastAPI + SQLAlchemy 2 + PostgreSQL/PostGIS (SQLite en desarrollo).
- **Datos abiertos:** exportación CSV, GeoJSON, JSON y ZIP bajo **CC BY 4.0**.
- **Código:** **MIT**.

> [!IMPORTANT]
> Los 7 puntos de seguimiento incluidos usan **coordenadas aproximadas y no
> verificadas** (`coords_verified: false`). Deben comprobarse sobre el terreno y
> con glaciólogos antes de cualquier publicación pública. Véanse
> [`backend/seed/points.json`](../backend/seed/points.json) y
> [`ETHICS.md`](ETHICS.md).
>
> **Las fotos ciudadanas son observaciones, no mediciones.** No sustituyen el
> balance de masa glaciar, los levantamientos topográficos ni el trabajo de las
> estaciones científicas.

---

## Inicio rápido

### Opción A — Docker Compose (recomendada)

Requiere Docker Engine 24+ con el plugin Compose. Ejecuta desde la raíz del
repositorio:

```bash
cp .env.example .env
docker compose up --build
```

Abre **<http://localhost:8080>**. El primer arranque tarda unos 15–30 segundos: el
backend aplica las migraciones, carga 7 puntos y 8 miradores, y genera 35 fotos
de demostración sintéticas claramente etiquetadas.

| Dirección | Uso |
| --- | --- |
| <http://localhost:8080> | PWA: mapa, galería, captura, exportaciones |
| <http://localhost:8080/docs> | Documentación interactiva OpenAPI |
| <http://localhost:8000/api/health> | Estado de la API directamente |
| <http://localhost:8080/api/export/photos.geojson> | Exportación de datos abiertos |

Para detener: `docker compose down`. Añade `-v` para borrar también los volúmenes
de base de datos y multimedia.

### Opción B — desarrollo local

Backend (Python 3.12+):

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

La API queda en <http://127.0.0.1:8000>, usando SQLite
(`backend/data/muzdyq.db`) y un directorio multimedia local; los datos de
demostración se crean al arrancar.

Frontend (Node 22+):

```bash
cd frontend
npm ci
npm run dev
```

Abre <http://127.0.0.1:5173>. Vite redirige `/api`, `/media`, `/docs` y
`/openapi.json` al backend, así que no hace falta configurar CORS ni claves.

---

## Funciones

### Mapa y panel del punto
- Mapa ráster MapLibre (OpenStreetMap; OpenTopoMap en modo detallado) con marcadores
  de glaciares y cuerpos de agua.
- Panel lateral en escritorio y panel inferior en móvil: descripción, aviso de
  seguridad, coordenadas, altitud y advertencia de coordenadas no verificadas.
- Selector de mirador, foto de referencia y enlace QR para carteles en el sendero.
- Filtro por año, comparador antes/después, timelapse en el cliente y galería.
- Descargas CSV, GeoJSON, JSON y ZIP por punto y para todo el archivo.

### Captura (`/p/:slug/:viewpointId`)
- Cámara trasera cuando está disponible; si no, selector de archivo.
- **Superposición de referencia** semitransparente con opacidad ajustable.
- Etiquetas opcionales de clima, visibilidad y nieve.
- Redimensionado en el dispositivo (~1600 px, JPEG 0.75), eliminación de EXIF/GPS,
  pixelado de rostros en el navegador y miniatura.
- Cola de subida en IndexedDB, UUID idempotente, retroceso exponencial, reintento
  manual y Background Sync cuando el navegador lo admite.
- Modo verde activado por defecto: teselas ligeras, sin reproducción automática,
  descarga de una región para uso sin conexión y sin analítica.

### Backend
- Subidas anónimas, sin cuentas ni identidad del colaborador.
- Validación de MIME y tamaño en servidor, eliminación de EXIF, desenfoque de
  rostros (OpenCV YuNet, respaldo Haar), miniaturas, hash perceptual para detectar
  duplicados, `taken_at` redondeado a la hora y límites por hash de IP/dispositivo.
- Moderación con `X-Admin-Token`; la interfaz no usa esos endpoints.
- Las exportaciones incluyen metadatos, coordenadas, licencia y el aviso científico.

### Idiomas y accesibilidad
- Interfaces en kazajo, ruso e inglés; el selector siempre está visible.
- Tema oscuro, navegación por teclado, enlace de salto y contraste orientado a
  WCAG; diseño comprobado a 360 px de ancho.

---

## API de un vistazo

Los endpoints públicos no requieren autenticación.

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/api/points` | Todos los puntos, miradores y número de fotos |
| `GET` | `/api/points/{slug}` | Un punto |
| `GET` | `/api/points/{slug}/photos` | Fotos publicadas; `year`, `from`, `to`, `cursor` |
| `POST` | `/api/points/{slug}/photos` | Subida anónima; `client_uuid` hace seguros los reintentos |
| `GET` | `/api/export/photos.csv` | Metadatos en CSV |
| `GET` | `/api/export/photos.geojson` | GeoJSON |
| `GET` | `/api/export/photos.json` | Paquete JSON con licencia |
| `GET` | `/api/export/photos.zip` | Imágenes + metadatos + licencia |
| `GET` | `/api/health` | Estado del servicio, base de datos y almacenamiento |
| `GET` | `/docs` | Swagger UI |

Referencia completa: [`API.md`](API.md) y `/docs` en el servidor.

Ejemplo de subida:

```bash
curl -X POST http://localhost:8080/api/points/tuyuksu-glacier/photos \
  -F "file=@photo.jpg" \
  -F "viewpoint_id=tuyuksu-glacier-v1" \
  -F "taken_at=2026-07-01T09:00:00Z" \
  -F "client_uuid=$(uuidgen)" \
  -F 'tags={"weather":"clear","snow_cover":"partial"}'
```

---

## Pruebas

```bash
# Backend
cd backend
./venv/bin/ruff check app tests
./venv/bin/pytest -q                 # 28 pruebas

# Frontend
cd frontend
npm run lint
npx tsc -b
npm test                             # 14 pruebas Vitest
npm run build
npm run e2e                          # Playwright, 3 perfiles
```

Las pruebas del backend cubren eliminación de EXIF, desenfoque de rostros,
idempotencia de subidas, exportaciones y límites de frecuencia. La prueba de cola
verifica reintentos y reutilización de UUID. Playwright usa una API simulada y no
necesita backend.

---

## Configuración

Copia [`.env.example`](../.env.example) a `.env`. Ajustes principales:

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `DATABASE_URL` | SQLite en `backend/data/` | En Compose: `postgresql+psycopg://…` |
| `MEDIA_ROOT` | `./data/media` | Originales y miniaturas |
| `ADMIN_TOKEN` | valor de desarrollo | **Cámbialo antes de publicar** |
| `IP_HASH_SALT` | valor de desarrollo | **Cámbialo antes de publicar** |
| `SEED_DEMO` | `true` | Fotos de demostración sintéticas |
| `UPLOAD_LIMIT_PER_HOUR` | `40` | Límite por hash de IP/dispositivo |
| `PUBLIC_BASE_URL` | vacío | URL absolutas en exportaciones |

---

## Privacidad y ética

- Sin cuentas, perfiles, valoraciones, clasificaciones, rachas ni insignias.
- No se suben ni publican GPS ni EXIF: el cliente los elimina y el servidor vuelve
  a eliminarlos.
- Los rostros se difuminan en el dispositivo cuando es posible y siempre en el
  servidor.
- Sin analítica de terceros, rastreadores ni cookies publicitarias.
- Las fotos se publican bajo **CC BY 4.0**; quien contribuye debe tener derecho a
  compartirlas.
- Se muestran normas de seguridad en cada ruta de contribución. No salgas del
  sendero señalizado ni te acerques a glaciares, morrenas, agua o nieve empinada
  por una foto.

Más información: [`ETHICS.md`](ETHICS.md) y la página «Ética y privacidad» de la
aplicación.

---

## Estructura del repositorio

```
backend/      FastAPI, migraciones, datos semilla, pruebas
frontend/     React + TypeScript PWA, service worker, e2e
docs/         arquitectura, API, ética, licencia, offline, DPG
deploy/       ejemplo de nginx con TLS
docker-compose.yml
.env.example
```

---

## Documentación

- [Arquitectura](ARCHITECTURE.md)
- [API](API.md)
- [Lista de Digital Public Good](DPG_CHECKLIST.md)
- [Ética y privacidad](ETHICS.md)
- [Licencia de datos](DATA_LICENSE.md)
- [Uso sin conexión y modo verde](OFFLINE.md)
- [Guía de contribución](../CONTRIBUTING.md)

---

## Licencia

- **Código:** MIT — véase [`LICENSE`](../LICENSE).
- **Fotos y metadatos:** CC BY 4.0 — véase [`DATA_LICENSE.md`](DATA_LICENSE.md).
- **Teselas del mapa:** © colaboradores de OpenStreetMap (ODbL);
  OpenTopoMap (CC BY-SA).
- Las imágenes de demostración son sintéticas y no representan observaciones reales.

Muzdyq se alinea con el **ODS 13 (acción por el clima)**, el **ODS 6.6
(ecosistemas hídricos)** y los principios de los bienes públicos digitales:
licencia abierta, datos abiertos, privacidad por diseño y ausencia de dependencia
de proveedores.

---

*Esta traducción cubre lo esencial; el [README en inglés](../README.md) es la
versión canónica. Si hay discrepancias, prevalece el texto en inglés.*
