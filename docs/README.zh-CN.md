# Muzdyq · 冰川

[English](../README.md) · [Русский](README.ru.md) · [Қазақша](README.kk.md) · **简体中文** · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português (BR)](README.pt-BR.md)

**面向伊犁阿拉套山（外伊犁阿拉套）冰川与水体、无需账户的开放公民科学照片档案。**

Muzdyq（哈萨克语意为“冰川”）让任何站在标记步道上的人都能在固定视角拍摄可重复的照片。随着时间推移，这些照片会成为公开、可比较的视觉记录，展示冰川消融和山地湖泊的变化。

- **Web 应用：** React 19 + TypeScript + Vite PWA、Ant Design、MapLibre GL，支持哈萨克语 / 俄语 / 英语。
- **API：** FastAPI + SQLAlchemy 2 + PostgreSQL/PostGIS（开发环境使用 SQLite）。
- **开放数据：** CSV、GeoJSON、JSON 和 ZIP 导出，采用 **CC BY 4.0** 许可。
- **代码：** **MIT**。

> [!IMPORTANT]
> 种子数据中的 7 个监测点使用**近似且未经核实的坐标**
> （`coords_verified: false`）。在任何公开发布之前，必须由冰川学家和实地考察确认。
> 参见 [`backend/seed/points.json`](../backend/seed/points.json) 和
> [`ETHICS.md`](ETHICS.md)。
>
> **公民照片是观察记录，不是测量数据。** 它们不能替代冰川物质平衡、测量测绘或科研站的工作。

---

## 快速开始

### 方式 A — Docker Compose（推荐）

需要 Docker Engine 24+ 和 Compose 插件。请在仓库根目录执行：

```bash
cp .env.example .env
docker compose up --build
```

打开 **<http://localhost:8080>**。首次启动约需 15–30 秒：后端执行数据库迁移，导入 7 个监测点和 8 个拍摄视角，并生成 35 张明确标注的合成演示照片。

| 地址 | 用途 |
| --- | --- |
| <http://localhost:8080> | PWA：地图、图库、拍摄、导出 |
| <http://localhost:8080/docs> | 交互式 OpenAPI 文档 |
| <http://localhost:8000/api/health> | 直接访问 API 健康状态 |
| <http://localhost:8080/api/export/photos.geojson> | 开放数据导出 |

停止服务：`docker compose down`。加上 `-v` 会同时删除数据库和媒体卷。

### 方式 B — 本地开发

后端（Python 3.12+）：

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

API 位于 <http://127.0.0.1:8000>，默认使用 SQLite（`backend/data/muzdyq.db`）和本地媒体目录；启动时会写入演示数据。

前端（Node 22+）：

```bash
cd frontend
npm ci
npm run dev
```

打开 <http://127.0.0.1:5173>。Vite 会将 `/api`、`/media`、`/docs` 和 `/openapi.json` 代理到后端，因此无需配置 CORS 或 API 密钥。

---

## 功能

### 地图与监测点面板
- MapLibre 栅格地图（OpenStreetMap；详细模式使用 OpenTopoMap），显示冰川和水体标记。
- 桌面端侧边抽屉 / 移动端底部面板：描述、安全提示、坐标、海拔和未核实坐标警告。
- 拍摄视角选择、参考照片，以及用于步道标牌的 QR 深链接。
- 年份筛选、前后对比滑块、客户端延时播放和图库。
- 按监测点或全库下载 CSV、GeoJSON、JSON 和 ZIP。

### 拍摄流程（`/p/:slug/:viewpointId`）
- 优先使用后置摄像头，不支持时选择文件。
- 半透明**参考影像叠加层**，可调透明度。
- 可选标签：天气、能见度、积雪覆盖。
- 设备端压缩（约 1600 px、JPEG 0.75）、移除 EXIF/GPS、浏览器端人脸像素化并生成缩略图。
- IndexedDB 上传队列、UUID 幂等、指数退避、手动重试，以及浏览器支持时的 Background Sync。
- 默认开启绿色模式：轻量地图瓦片、不自动播放、可下载离线区域，且没有分析追踪。

### 后端
- 匿名上传，无账户、无贡献者身份。
- 服务端校验 MIME 和大小，移除 EXIF，模糊人脸（OpenCV YuNet，Haar 备用），生成缩略图，感知哈希去重，将 `taken_at` 向下取整到小时，并按 IP/设备哈希限流。
- 通过 `X-Admin-Token` 进行审核；前端不调用这些管理端点。
- 导出包含元数据、坐标、许可和科学免责声明。

### 语言与无障碍
- 哈萨克语、俄语和英语界面；语言切换器始终可见。
- 深色模式、键盘导航、跳转链接和符合 WCAG 目标的对比度；已验证 360 px 宽度布局。

---

## API 一览

公开端点无需认证。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/points` | 所有监测点、视角和照片数量 |
| `GET` | `/api/points/{slug}` | 单个监测点 |
| `GET` | `/api/points/{slug}/photos` | 已发布照片；支持 `year`、`from`、`to`、`cursor` |
| `POST` | `/api/points/{slug}/photos` | 匿名上传；`client_uuid` 保证重试安全 |
| `GET` | `/api/export/photos.csv` | CSV 元数据 |
| `GET` | `/api/export/photos.geojson` | GeoJSON |
| `GET` | `/api/export/photos.json` | 含许可信息的 JSON 数据包 |
| `GET` | `/api/export/photos.zip` | 图片 + 元数据 + 许可 |
| `GET` | `/api/health` | 服务、数据库和存储状态 |
| `GET` | `/docs` | Swagger UI |

完整说明见 [`API.md`](API.md) 和运行中的 `/docs`。

上传示例：

```bash
curl -X POST http://localhost:8080/api/points/tuyuksu-glacier/photos \
  -F "file=@photo.jpg" \
  -F "viewpoint_id=tuyuksu-glacier-v1" \
  -F "taken_at=2026-07-01T09:00:00Z" \
  -F "client_uuid=$(uuidgen)" \
  -F 'tags={"weather":"clear","snow_cover":"partial"}'
```

---

## 测试

```bash
# 后端
cd backend
./venv/bin/ruff check app tests
./venv/bin/pytest -q                 # 28 个测试

# 前端
cd frontend
npm run lint
npx tsc -b
npm test                             # 14 个 Vitest 测试
npm run build
npm run e2e                          # Playwright，3 种视口
```

后端测试覆盖 EXIF 移除、人脸模糊、上传幂等、导出和限流。队列测试覆盖重试和 UUID 复用。Playwright 使用模拟 API，无需启动后端。

---

## 配置

将 [`.env.example`](../.env.example) 复制为 `.env`。主要配置项：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | `backend/data/` 中的 SQLite | Compose 使用 `postgresql+psycopg://…` |
| `MEDIA_ROOT` | `./data/media` | 原图与缩略图 |
| `ADMIN_TOKEN` | 开发默认值 | **公开发布前必须更换** |
| `IP_HASH_SALT` | 开发默认值 | **公开发布前必须更换** |
| `SEED_DEMO` | `true` | 合成演示照片 |
| `UPLOAD_LIMIT_PER_HOUR` | `40` | 每个 IP/设备哈希的小时限额 |
| `PUBLIC_BASE_URL` | 空 | 导出中的绝对链接 |

---

## 隐私与伦理

- 没有账户、个人资料、评分、排行榜、连续记录或徽章。
- 不上传或发布 GPS 与 EXIF：客户端移除一次，服务器再次移除。
- 人脸尽量在设备端模糊，并在服务器端再次处理。
- 没有第三方分析、跟踪器或广告 Cookie。
- 照片以 **CC BY 4.0** 发布；贡献者须拥有发布权利。
- 每条贡献路径都会显示安全提示。不要为了拍照离开标记步道、接近冰川末端、冰碛、水边或陡峭雪坡。

详见 [`ETHICS.md`](ETHICS.md) 和应用内的“伦理与隐私”页面。

---

## 仓库结构

```
backend/      FastAPI、迁移、种子数据、测试
frontend/     React + TypeScript PWA、Service Worker、e2e
docs/         架构、API、伦理、许可、离线、DPG
deploy/       带 TLS 的 nginx 示例
docker-compose.yml
.env.example
```

---

## 文档

- [架构](ARCHITECTURE.md)
- [API](API.md)
- [数字公共产品清单](DPG_CHECKLIST.md)
- [伦理与隐私](ETHICS.md)
- [数据许可](DATA_LICENSE.md)
- [离线与绿色模式](OFFLINE.md)
- [贡献指南](../CONTRIBUTING.md)

---

## 许可

- **代码：** MIT — 见 [`LICENSE`](../LICENSE)。
- **照片与元数据：** CC BY 4.0 — 见 [`DATA_LICENSE.md`](DATA_LICENSE.md)。
- **地图瓦片：** © OpenStreetMap 贡献者（ODbL）；OpenTopoMap（CC BY-SA）。
- 演示图像为合成内容，不代表真实观测。

Muzdyq 与 **联合国可持续发展目标 13（气候行动）**、**目标 6.6（水相关生态系统）** 以及数字公共产品原则保持一致：开放许可、开放数据、默认隐私保护和无供应商锁定。

---

*本译文涵盖主要内容；以[英文 README](../README.md) 为准。如有不一致，以英文版本为准。*
