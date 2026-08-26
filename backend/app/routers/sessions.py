import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionDep
from app.deps import CurrentUser
from app.models import Asset, EditSession, User
from app.schemas.agent import MessageIn, TurnOut
from app.schemas.asset import AssetOut
from app.schemas.run import RunOut
from app.schemas.session import (
    HistoryOut,
    SessionCreateIn,
    SessionDetailOut,
    SessionOut,
    SessionPatchIn,
    ToolInvokeIn,
    ToolInvokeOut,
)
from app.services import agent as agent_service
from app.services import assets as asset_service
from app.services import sessions, tools
from app.services.sessions import CannotRedo, CannotUndo, SessionNotFound
from app.services.tools import InvalidParams
from app.tools import UnknownTool

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
    can_undo, can_redo = await sessions.undo_state(session, record)
    return SessionDetailOut.of_detail(
        record,
        [AssetOut.of(asset) for asset in wall],
        previous_document=await sessions.previous_document(session, record),
        can_undo=can_undo,
        can_redo=can_redo,
    )


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


@router.post("/{session_id}/tools", status_code=status.HTTP_202_ACCEPTED)
async def invoke_tool(
    session_id: uuid.UUID, payload: ToolInvokeIn, user: CurrentUser, session: SessionDep
) -> ToolInvokeOut:
    record = await _load(session, user, session_id)
    try:
        run = await tools.submit(session, user.id, payload.tool, payload.params, record.id)
    except UnknownTool as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except InvalidParams as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    record = await sessions.get_for_user(session, record.id, user.id)
    return ToolInvokeOut(run=RunOut.of(run), session=await _detail(session, record))


@router.post("/{session_id}/undo")
async def undo_session(
    session_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> SessionDetailOut:
    record = await _load(session, user, session_id)
    try:
        record = await sessions.undo(session, record)
    except CannotUndo as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "没有可撤销的操作") from exc
    return await _detail(session, record)


@router.post("/{session_id}/redo")
async def redo_session(
    session_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> SessionDetailOut:
    record = await _load(session, user, session_id)
    try:
        record = await sessions.redo(session, record)
    except CannotRedo as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "没有可重做的操作") from exc
    return await _detail(session, record)


@router.get("/{session_id}/history")
async def get_history(
    session_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> list[HistoryOut]:
    record = await _load(session, user, session_id)
    entries = await sessions.history_of(session, record)
    return [HistoryOut.of(entry) for entry in entries]


@router.get("/{session_id}/messages")
async def list_messages(
    session_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> list[TurnOut]:
    record = await _load(session, user, session_id)
    return [TurnOut.of(turn) for turn in await agent_service.turns_of(session, record)]


@router.post("/{session_id}/messages", status_code=status.HTTP_201_CREATED)
async def send_message(
    session_id: uuid.UUID, payload: MessageIn, user: CurrentUser, session: SessionDep
) -> TurnOut:
    record = await _load(session, user, session_id)
    return TurnOut.of(await agent_service.respond(session, record, payload.text))
