from fastapi import APIRouter, FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routers import health

settings = get_settings()

app = FastAPI(title="AI 修图智能体", docs_url="/api/docs", openapi_url="/api/openapi.json")

api = APIRouter(prefix="/api")
api.include_router(health.router)
app.include_router(api)

# 生产环境下前端与 API 同源，静态产物由本服务托管；开发环境走 Vite dev proxy。
if settings.frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="frontend")
