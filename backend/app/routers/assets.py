import uuid
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from app.db import SessionDep
from app.deps import CurrentUser
from app.models.asset import AssetKind, AssetSource
from app.schemas.asset import AssetOut
from app.services import assets as asset_service
from app.services.images import MAX_FILE_BYTES, ImageRejected, probe

router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload(
    user: CurrentUser,
    session: SessionDep,
    file: Annotated[UploadFile, File()],
) -> AssetOut:
    data = await file.read()
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "文件超过 20 MB 上限")

    try:
        meta = probe(data)
    except ImageRejected as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc

    asset = await asset_service.create_from_bytes(
        session, user.id, data, AssetKind.ORIGINAL, AssetSource.UPLOAD, meta
    )
    return AssetOut.of(asset)


@router.get("")
async def list_assets(
    user: CurrentUser,
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[AssetOut]:
    records = await asset_service.list_for_user(session, user.id, limit)
    return [AssetOut.of(asset) for asset in records]


@router.get("/{asset_id}")
async def get_asset(asset_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> AssetOut:
    asset = await asset_service.get_for_user(session, user.id, asset_id)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "素材不存在")
    return AssetOut.of(asset)
