import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionDep
from app.deps import CurrentUser
from app.models import Asset, EditSession, User
from app.schemas.asset import AssetOut
from app.schemas.session import (
    HistoryOut,
    SessionCreateIn,
    SessionDetailOut,
    SessionOut,
    SessionPatchIn,
)
from app.services import assets as asset_service
from app.services import sessions
from app.services.sessions import SessionNotFound

router = APIRouter(prefix="/sessions", tags=["sessions"])


async def _asset(session: AsyncSession, user: User, asset_id: uuid.UUID) -> Asset:
    asset = await asset_service.get_for_user(session, user.id, asset_id)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "素材不存在")
    return asset


async def _load(session: AsyncSession, user: User, session_id: uuid.UUID) -> EditSession:
    try:
        return await sessions.get_for_user(session, session_id, user.id)
    except SessionNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "会话不存在") from exc


async def _detail(session: AsyncSession, record: EditSession) -> SessionDetailOut:
    wall = await sessions.assets_of(session, record)
    return SessionDetailOut.of_detail(record, [AssetOut.of(asset) for asset in wall])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreateIn, user: CurrentUser, session: SessionDep
) -> SessionDetailOut:
    current = await _asset(session, user, payload.current_asset_id)
    wall = [
        await _asset(session, user, asset_id)
        for asset_id in payload.asset_ids
        if asset_id != current.id
    ]

    record = await sessions.create(session, user.id, current, wall, payload.title)
    return await _detail(session, record)


@router.get("")
async def list_sessions(
    user: CurrentUser,
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[SessionOut]:
    records = await sessions.list_for_user(session, user.id, limit)
    return [SessionOut.of(record) for record in records]


@router.get("/{session_id}")
async def get_session(
    session_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> SessionDetailOut:
    return await _detail(session, await _load(session, user, session_id))


@router.patch("/{session_id}")
async def patch_session(
    session_id: uuid.UUID, payload: SessionPatchIn, user: CurrentUser, session: SessionDep
) -> SessionDetailOut:
    record = await _load(session, user, session_id)

    if payload.title is not None:
        record = await sessions.rename(session, record, payload.title)
    if payload.current_asset_id is not None:
        asset = await _asset(session, user, payload.current_asset_id)
        record = await sessions.switch_current(session, record, asset)

    return await _detail(session, record)


@router.get("/{session_id}/history")
async def get_history(
    session_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> list[HistoryOut]:
    record = await _load(session, user, session_id)
    entries = await sessions.history_of(session, record)
    return [HistoryOut.of(entry) for entry in entries]
