import uuid
from collections.abc import Iterable

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.layers import document_of
from app.models import Asset, EditHistory, EditSession, SessionAsset
from app.models.edit_history import HISTORY_LIMIT

TITLE_LIMIT = 80
DEFAULT_TITLE = "未命名会话"


class SessionNotFound(Exception):
    pass


def normalize_title(text: str | None) -> str:
    cleaned = " ".join((text or "").split())
    return cleaned[:TITLE_LIMIT] or DEFAULT_TITLE


async def _next_position(session: AsyncSession, session_id: uuid.UUID) -> int:
    last = await session.scalar(
        select(func.max(SessionAsset.position)).where(SessionAsset.session_id == session_id)
    )
    return (last or 0) + 1


async def _attach(session: AsyncSession, record: EditSession, assets: Iterable[Asset]) -> None:
    known = set(
        await session.scalars(
            select(SessionAsset.asset_id).where(SessionAsset.session_id == record.id)
        )
    )
    position = await _next_position(session, record.id)

    for asset in assets:
        if asset.id in known:
            continue
        session.add(SessionAsset(session_id=record.id, asset_id=asset.id, position=position))
        known.add(asset.id)
        position += 1


async def _append_history(
    session: AsyncSession, record: EditSession, action: str, params: dict, result: dict
) -> None:
    last = await session.scalar(
        select(func.max(EditHistory.seq)).where(EditHistory.session_id == record.id)
    )
    seq = (last or 0) + 1
    session.add(
        EditHistory(
            user_id=record.user_id,
            session_id=record.id,
            seq=seq,
            action=action,
            params=params,
            result=result,
        )
    )
    await session.execute(
        delete(EditHistory).where(
            EditHistory.session_id == record.id, EditHistory.seq <= seq - HISTORY_LIMIT
        )
    )


async def create(
    session: AsyncSession,
    user_id: uuid.UUID,
    current: Asset,
    wall: Iterable[Asset] = (),
    title: str | None = None,
) -> EditSession:
    """新建会话。current 进入画布，wall 中其余图片仅进图片墙备选。"""
    record = EditSession(
        user_id=user_id,
        title=normalize_title(title),
        original_asset_id=current.id,
        current_asset_id=current.id,
        document=document_of(current).model_dump(mode="json"),
    )
    session.add(record)
    await session.flush()

    await _attach(session, record, [current, *wall])
    await _append_history(session, record, "create_session", {}, {"asset_id": str(current.id)})
    await session.commit()
    await session.refresh(record)
    return record


async def load(session: AsyncSession, session_id: uuid.UUID) -> EditSession:
    """不带用户过滤的读取，仅供已确认归属的后台任务使用。"""
    record = await session.get(EditSession, session_id)
    if record is None:
        raise SessionNotFound
    return record


async def get_for_user(
    session: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID
) -> EditSession:
    record = await session.scalar(
        select(EditSession).where(EditSession.id == session_id, EditSession.user_id == user_id)
    )
    if record is None:
        raise SessionNotFound
    return record


async def list_for_user(
    session: AsyncSession, user_id: uuid.UUID, limit: int = 50
) -> list[EditSession]:
    result = await session.scalars(
        select(EditSession)
        .where(EditSession.user_id == user_id)
        .order_by(EditSession.updated_at.desc())
        .limit(limit)
    )
    return list(result)


async def assets_of(session: AsyncSession, record: EditSession) -> list[Asset]:
    result = await session.scalars(
        select(Asset)
        .join(SessionAsset, SessionAsset.asset_id == Asset.id)
        .where(SessionAsset.session_id == record.id)
        .order_by(SessionAsset.position)
    )
    return list(result)


async def history_of(session: AsyncSession, record: EditSession) -> list[EditHistory]:
    result = await session.scalars(
        select(EditHistory)
        .where(EditHistory.session_id == record.id)
        .order_by(EditHistory.seq.desc())
    )
    return list(result)


async def record_result(
    session: AsyncSession,
    record: EditSession,
    assets: Iterable[Asset],
    action: str,
    params: dict,
    result: dict,
) -> None:
    """工具产出并入图片墙并留下编辑记录。不改当前图，采用与否交给用户。"""
    await _attach(session, record, assets)
    await _append_history(session, record, action, params, result)
    await session.commit()


async def rename(session: AsyncSession, record: EditSession, title: str) -> EditSession:
    record.title = normalize_title(title)
    await session.commit()
    await session.refresh(record)
    return record


async def switch_current(session: AsyncSession, record: EditSession, asset: Asset) -> EditSession:
    """切换画布当前图。修订号递增，使旧修订号上的选区与遮罩失效。"""
    if record.current_asset_id != asset.id:
        record.current_asset_id = asset.id
        record.revision += 1
        record.document = document_of(asset).model_dump(mode="json")
        await _attach(session, record, [asset])
        await _append_history(
            session,
            record,
            "switch_current",
            {"asset_id": str(asset.id)},
            {"revision": record.revision},
        )
    await session.commit()
    await session.refresh(record)
    return record
