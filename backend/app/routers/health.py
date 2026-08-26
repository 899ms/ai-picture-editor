from collections.abc import Awaitable

from fastapi import APIRouter
from sqlalchemy import text

from app.db import SessionDep

router = APIRouter(prefix="/health", tags=["health"])


async def _probe(awaitable: Awaitable) -> str:
    try:
        await awaitable
        return "ok"
    except Exception as exc:  # noqa: BLE001 - 健康检查需要报告任意故障原因
        return f"error: {type(exc).__name__}"


@router.get("")
async def health(session: SessionDep) -> dict[str, str]:
    return {"api": "ok", "database": await _probe(session.execute(text("select 1")))}
