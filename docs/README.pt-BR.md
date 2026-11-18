# Muzdyq · Geleira

[English](../README.md) · [Русский](README.ru.md) · [Қазақша](README.kk.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Português (BR)**

**Arquivo fotográfico aberto de ciência cidadã para as geleiras e corpos d'água da
cordilheira Ile Alatau (Zailiysky Alatau), no Cazaquistão — sem contas, sem
rastreamento de localização e sem análises de terceiros.**

Muzdyq (palavra cazaque para "geleira") permite que qualquer pessoa em uma trilha
sinalizada registre uma foto repetível a partir de um ponto de vista fixo. Com o
passar dos anos, essas fotos formam um registro visual público e comparável do
recuo das geleiras e das mudanças nos lagos de montanha.

- **Aplicativo web:** React 19 + TypeScript + Vite PWA, Ant Design, MapLibre GL,
  cazaque / russo / inglês.
- **API:** FastAPI + SQLAlchemy 2 + PostgreSQL/PostGIS (SQLite em desenvolvimento).
- **Dados abertos:** exportação CSV, GeoJSON, JSON e ZIP sob **CC BY 4.0**.
- **Código:** **MIT**.

> [!IMPORTANT]
> Os 7 pontos de monitoramento incluídos usam **coordenadas aproximadas e não
> verificadas** (`coords_verified: false`). Elas precisam ser conferidas em campo e
> com glaciologistas antes de qualquer publicação pública. Veja
> [`backend/seed/points.json`](../backend/seed/points.json) e
> [`ETHICS.md`](ETHICS.md).
>
> **Fotos cidadãs são observações, não medições.** Elas não substituem o balanço
> de massa glacial, levantamentos geodésicos nem o trabalho de estações
> científicas.

---

## Início rápido

### Opção A — Docker Compose (recomendada)

Requer Docker Engine 24+ com o plugin Compose. Execute na raiz do repositório:

```bash
cp .env.example .env
docker compose up --build
```

Abra **<http://localhost:8080>**. A primeira inicialização leva cerca de 15–30
segundos: o backend aplica as migrações, carrega 7 pontos e 8 pontos de vista e
gera 35 fotos de demonstração sintéticas claramente rotuladas.

| Endereço | Uso |
| --- | --- |
| <http://localhost:8080> | PWA: mapa, galeria, captura, exportações |
| <http://localhost:8080/docs> | Documentação OpenAPI interativa |
| <http://localhost:8000/api/health> | Status da API diretamente |
| <http://localhost:8080/api/export/photos.geojson> | Exportação de dados abertos |

Para parar: `docker compose down`. A opção `-v` também remove os volumes de banco
de dados e de mídia.

### Opção B — desenvolvimento local

Backend (Python 3.12+):

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

A API fica em <http://127.0.0.1:8000>, usando SQLite (`backend/data/muzdyq.db`) e
um diretório local de mídia; os dados de demonstração são criados na
inicialização.

Frontend (Node 22+):

```bash
cd frontend
npm ci
npm run dev
```

Abra <http://127.0.0.1:5173>. O Vite encaminha `/api`, `/media`, `/docs` e
`/openapi.json` para o backend, então não é preciso configurar CORS nem chaves de
API.

---

## Recursos

### Mapa e painel do ponto
- Mapa raster MapLibre (OpenStreetMap; OpenTopoMap no modo detalhado) com marcadores
  de geleiras e corpos d'água.
- Painel lateral no desktop e painel inferior no celular: descrição, orientações
  de segurança, coordenadas, altitude e aviso de dados não verificados.
- Seleção do ponto de vista, foto de referência e link QR para placas na trilha.
- Filtro por ano, comparação antes/depois, timelapse no cliente e galeria.
- Downloads CSV, GeoJSON, JSON e ZIP por ponto e para todo o arquivo.

### Captura (`/p/:slug/:viewpointId`)
- Câmera traseira quando disponível; caso contrário, seleção de arquivo.
- **Sobreposição de referência** semitransparente com opacidade ajustável.
- Etiquetas opcionais: clima, visibilidade e cobertura de neve.
- Redimensionamento no dispositivo (~1600 px, JPEG 0.75), remoção de EXIF/GPS,
  pixelização de rostos no navegador e miniatura.
- Fila de upload no IndexedDB, UUID idempotente, espera exponencial, nova
  tentativa manual e Background Sync quando suportado.
- Modo verde ativado por padrão: tiles leves, sem reprodução automática, download
  de uma área do mapa para uso offline e sem análises.

### Backend
- Uploads anônimos, sem contas nem identidade de quem contribui.
- Validação de MIME e tamanho no servidor, remoção de EXIF, desfoque de rostos
  (OpenCV YuNet, Haar como alternativa), miniaturas, hash perceptual para detectar
  duplicatas, `taken_at` arredondado para a hora e limite por hash de IP/dispositivo.
- Moderação via `X-Admin-Token`; a interface não usa esses endpoints.
- As exportações incluem metadados, coordenadas, licença e o aviso científico.

### Idiomas e acessibilidade
- Interfaces em cazaque, russo e inglês; o seletor de idioma fica sempre visível.
- Tema escuro, navegação por teclado, link de salto e contraste orientado a WCAG;
  layout verificado em 360 px de largura.

---

## API em resumo

Os endpoints públicos não exigem autenticação.

| Método | Caminho | Uso |
| --- | --- | --- |
| `GET` | `/api/points` | Todos os pontos, pontos de vista e contagem de fotos |
| `GET` | `/api/points/{slug}` | Um ponto |
| `GET` | `/api/points/{slug}/photos` | Fotos publicadas; `year`, `from`, `to`, `cursor` |
| `POST` | `/api/points/{slug}/photos` | Upload anônimo; `client_uuid` torna as repetições seguras |
| `GET` | `/api/export/photos.csv` | Metadados em CSV |
| `GET` | `/api/export/photos.geojson` | GeoJSON |
| `GET` | `/api/export/photos.json` | Pacote JSON com licença |
| `GET` | `/api/export/photos.zip` | Imagens + metadados + licença |
| `GET` | `/api/health` | Status do serviço, do banco e do armazenamento |
| `GET` | `/docs` | Swagger UI |

Referência completa: [`API.md`](API.md) e `/docs` no servidor em execução.

Exemplo de upload:

```bash
curl -X POST http://localhost:8080/api/points/tuyuksu-glacier/photos \
  -F "file=@photo.jpg" \
  -F "viewpoint_id=tuyuksu-glacier-v1" \
  -F "taken_at=2026-07-01T09:00:00Z" \
  -F "client_uuid=$(uuidgen)" \
  -F 'tags={"weather":"clear","snow_cover":"partial"}'
```

---

## Testes

```bash
# Backend
cd backend
./venv/bin/ruff check app tests
./venv/bin/pytest -q                 # 28 testes

# Frontend
cd frontend
npm run lint
npx tsc -b
npm test                             # 14 testes Vitest
npm run build
npm run e2e                          # Playwright, 3 perfis
```

Os testes do backend cobrem remoção de EXIF, desfoque de rostos, idempotência de
upload, exportações e limite de requisições. O teste da fila verifica novas
tentativas e reutilização de UUID. O Playwright usa uma API simulada e não precisa
do backend em execução.

---

## Configuração

Copie [`.env.example`](../.env.example) para `.env`. Principais ajustes:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `DATABASE_URL` | SQLite em `backend/data/` | No Compose: `postgresql+psycopg://…` |
| `MEDIA_ROOT` | `./data/media` | Originais e miniaturas |
| `ADMIN_TOKEN` | valor de desenvolvimento | **Troque antes de publicar** |
| `IP_HASH_SALT` | valor de desenvolvimento | **Troque antes de publicar** |
| `SEED_DEMO` | `true` | Fotos de demonstração sintéticas |
| `UPLOAD_LIMIT_PER_HOUR` | `40` | Limite por hash de IP/dispositivo |
| `PUBLIC_BASE_URL` | vazio | URLs absolutas nas exportações |

---

## Privacidade e ética

- Sem contas, perfis, avaliações, rankings, sequências ou emblemas.
- GPS e EXIF não são enviados nem publicados: o cliente os remove e o servidor
  remove novamente.
- Rostos são desfocados no dispositivo quando possível e sempre no servidor.
- Sem análises de terceiros, rastreadores ou cookies publicitários.
- As fotos são publicadas sob **CC BY 4.0**; quem contribui confirma ter direito
  de compartilhá-las.
- As orientações de segurança aparecem em todo caminho de contribuição. Não saia
  da trilha sinalizada nem se aproxime de geleiras, morenas, água ou neve íngreme
  por causa de uma foto.

Saiba mais: [`ETHICS.md`](ETHICS.md) e a página "Ética e privacidade" no
aplicativo.

---

## Estrutura do repositório

```
backend/      FastAPI, migrações, dados de seed, testes
frontend/     React + TypeScript PWA, service worker, e2e
docs/         arquitetura, API, ética, licença, offline, DPG
deploy/       exemplo de nginx com TLS
docker-compose.yml
.env.example
```

---

## Documentação

- [Arquitetura](ARCHITECTURE.md)
- [API](API.md)
- [Lista Digital Public Good](DPG_CHECKLIST.md)
- [Ética e privacidade](ETHICS.md)
- [Licença de dados](DATA_LICENSE.md)
- [Offline e modo verde](OFFLINE.md)
- [Guia de contribuição](../CONTRIBUTING.md)

---

## Licença

- **Código:** MIT — veja [`LICENSE`](../LICENSE).
- **Fotos e metadados:** CC BY 4.0 — veja [`DATA_LICENSE.md`](DATA_LICENSE.md).
- **Tiles do mapa:** © colaboradores do OpenStreetMap (ODbL); OpenTopoMap
  (CC BY-SA).
- As imagens de demonstração são sintéticas e não representam observações reais.

O Muzdyq está alinhado ao **ODS 13 (ação climática)**, ao **ODS 6.6 (ecossistemas
hídricos)** e aos princípios de bens públicos digitais: licença aberta, dados
abertos, privacidade por padrão e ausência de dependência de fornecedor.

---

*Esta tradução cobre o essencial; o [README em inglês](../README.md) é a versão
canônica. Em caso de divergência, o texto em inglês prevalece.*
