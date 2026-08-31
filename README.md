# AI 修图智能体

## 依赖

- Python 3.13、[uv](https://docs.astral.sh/uv/)
- Node 22、npm
- Docker / Docker Compose

## 环境变量

```bash
cp .env.example .env
```

默认 `IMAGE_PROVIDER=mock`，使用本地占位图。接百炼时改为 `dashscope` 并填写 `DASHSCOPE_API_KEY`。生产环境必须替换 `JWT_SECRET`。

| 变量 | 说明 |
| --- | --- |
| `MATTING_PROVIDER` | `auto` 优先 rembg，`corner` 仅四角抠图 |
| `OCR_PROVIDER` | `auto` 有 rapidocr 则拆文字层，`none` 跳过 |
| `S3_PUBLIC_ENDPOINT` | 浏览器访问签名 URL 的地址；空则与 `S3_ENDPOINT` 相同 |

端口：前端 7301、API 7302、PostgreSQL 7311、Redis 7312、MinIO API 7313、MinIO Console 7314。

本地 CV 模型约 340 MB，缓存在 `~/.u2net`。容器部署时由 `cv_models` volume 挂载，app 与 worker 共用。

## 本地启动

```bash
docker compose up -d

cd backend && uv sync --all-extras && uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 7302

cd backend && uv run arq app.worker.WorkerSettings

cd frontend && npm install && npm run dev
```

浏览器打开 http://127.0.0.1:7301

停止中间件：`docker compose down`

## 部署

```bash
cp .env.example .env
docker compose --profile deploy up -d --build
docker compose --profile deploy exec app alembic upgrade head
```

访问 http://127.0.0.1:7302 。容器内数据库 / Redis / MinIO 地址由 compose 覆盖，无需改 `.env` 里的 localhost。

停止：`docker compose --profile deploy down`

## 测试与评测

```bash
cd backend && uv sync --all-extras --group dev && uv run pytest
cd frontend && npm install && npx tsc --noEmit

cd backend && uv run python -m app.eval app/eval/dataset
```

仓库自带一份无线耳机评测集（抠图、调色、交付尺寸）。自己加用例时按 `backend/app/eval/cases.example.json` 的格式准备 `cases.json` 和素材即可。
