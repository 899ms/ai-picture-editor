import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import storage
from app.models import Asset
from app.models.asset import AssetKind, AssetSource
from app.services.images import ImageMeta, probe


def _storage_key(user_id: uuid.UUID, asset_id: uuid.UUID, extension: str) -> str:
    return f"users/{user_id}/{asset_id}.{extension}"


async def create_from_bytes(
    session: AsyncSession,
    user_id: uuid.UUID,
    data: bytes,
    kind: AssetKind,
    source: AssetSource,
    meta: ImageMeta | None = None,
) -> Asset:
    """校验图片、写入对象存储并落库。所有素材以 user_id 为前缀隔离。"""
    meta = meta or probe(data)
    asset_id = uuid.uuid4()
    key = _storage_key(user_id, asset_id, meta.extension)

    await storage.put(key, data, meta.content_type)

    asset = Asset(
        id=asset_id,
        user_id=user_id,
        kind=kind,
        source=source,
        storage_key=key,
        image_format=meta.image_format,
        width=meta.width,
        height=meta.height,
        size_bytes=meta.size_bytes,
        has_alpha=meta.has_alpha,
    )
    session.add(asset)
    await session.commit()
    return asset


async def list_for_user(session: AsyncSession, user_id: uuid.UUID, limit: int = 50) -> list[Asset]:
    result = await session.scalars(
        select(Asset).where(Asset.user_id == user_id).order_by(Asset.created_at.desc()).limit(limit)
    )
    return list(result)


async def get_for_user(
    session: AsyncSession, user_id: uuid.UUID, asset_id: uuid.UUID
) -> Asset | None:
    """按主键与 user_id 联合查询，避免越权访问他人素材。"""
    return await session.scalar(select(Asset).where(Asset.id == asset_id, Asset.user_id == user_id))
