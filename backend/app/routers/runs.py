import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionDep
from app.deps import CurrentUser
from app.models.tool_run import ToolRun
from app.queue import enqueue
from app.schemas.asset import AssetOut
from app.schemas.run import GenerateIn, RunOut
from app.services import assets as asset_service
from app.services import generation, runs
from app.services.runs import RunNotFound

router = APIRouter(tags=["runs"])


async def _candidates(session: AsyncSession, run: ToolRun) -> list[AssetOut]:
    """候选图的签名 URL 有有效期，每次读取时重新签发。"""
    result = []
    for raw in run.result.get("asset_ids", []):
        asset = await asset_service.get_for_user(session, run.user_id, uuid.UUID(raw))
        if asset is not None:
            result.append(AssetOut.of(asset))
    return result


@router.post("/generations", status_code=status.HTTP_202_ACCEPTED)
async def create_generation(payload: GenerateIn, user: CurrentUser, session: SessionDep) -> RunOut:
    for asset_id in payload.reference_asset_ids:
        if await asset_service.get_for_user(session, user.id, asset_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "参考图不存在")

    params = payload.model_dump(mode="json")
    run = await runs.create(session, user.id, generation.TOOL, params)
    await enqueue("generate_images", run.id)
    return RunOut.of(run)


@router.get("/runs/{run_id}")
async def get_run(run_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> RunOut:
    try:
        run = await runs.get(session, run_id, user.id)
    except RunNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "任务不存在") from exc
    return RunOut.of(run, await _candidates(session, run))
