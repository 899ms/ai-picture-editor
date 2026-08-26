import uuid

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy import delete

from app.db import SessionFactory
from app.main import app
from app.models import User
from app.storage import ensure_bucket


@pytest.fixture(scope="session", autouse=True)
def bucket():
    ensure_bucket()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def credentials() -> dict[str, str]:
    return {"username": f"u{uuid.uuid4().hex[:10]}", "password": "secret123"}


@pytest.fixture(autouse=True)
async def cleanup_users():
    yield
    async with SessionFactory() as session:
        await session.execute(delete(User))
        await session.commit()
