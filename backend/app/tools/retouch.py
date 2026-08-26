import asyncio

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.edits.pixels import adjust, remove_background
from app.edits.render import TRANSPARENT
from app.models.asset import AssetKind, AssetSource
from app.models.tool_run import ToolRun
from app.services import assets, runs
from app.tools.base import ToolSpec
from app.tools.context import flatten_session, require_session


class RemoveBackgroundIn(BaseModel):
    pass


class AdjustIn(BaseModel):
    brightness: float = Field(default=0, ge=-1, le=1)
    contrast: float = Field(default=0, ge=-1, le=1)
    highlights: float = Field(default=0, ge=-1, le=1)
    shadows: float = Field(default=0, ge=-1, le=1)
    temperature: float = Field(default=0, ge=-1, le=1)
    tint: float = Field(default=0, ge=-1, le=1)
    saturation: float = Field(default=0, ge=-1, le=1)
    vibrance: float = Field(default=0, ge=-1, le=1)
    sharpness: float = Field(default=0, ge=-1, le=1)
    clarity: float = Field(default=0, ge=-1, le=1)
    vignette: float = Field(default=0, ge=0, le=1)


async def _adopt(session: AsyncSession, run: ToolRun, data: bytes, kind: AssetKind) -> dict:
    asset = await assets.create_from_bytes(session, run.user_id, data, kind, AssetSource.TOOL)
    return {"asset_ids": [str(asset.id)], "adopt_asset_id": str(asset.id)}


async def remove_background_exec(session: AsyncSession, run: ToolRun) -> dict:
    record = await require_session(session, run)
    await runs.report(session, run, 20, "识别主体")
    data = await flatten_session(session, record)
    await runs.report(session, run, 50, "去除背景")
    output = await asyncio.to_thread(remove_background, data)
    return await _adopt(session, run, output, AssetKind.SUBJECT)


async def adjust_image_exec(session: AsyncSession, run: ToolRun) -> dict:
    record = await require_session(session, run)
    await runs.report(session, run, 20, "读取画布")
    data = await flatten_session(session, record, background=TRANSPARENT)
    params = {key: value for key, value in run.params.items() if value}
    await runs.report(session, run, 60, "调整色彩")
    output = await asyncio.to_thread(lambda: adjust(data, **params))
    return await _adopt(session, run, output, AssetKind.GENERATED)


REMOVE_BACKGROUND = ToolSpec(
    name="remove_background",
    label="去背景",
    description="识别主体并输出透明 PNG。不要用它来换背景或生成新画面。",
    params=RemoveBackgroundIn,
    handler=remove_background_exec,
    queued=True,
    session_required=True,
)

ADJUST_IMAGE = ToolSpec(
    name="adjust_image",
    label="调色",
    description=(
        "调整当前画布的亮度、对比度、高光、阴影、色温、色调、饱和度、自然饱和度、锐化、清晰度和晕影。"
        "参数取值 -1 到 1，晕影为 0 到 1。未提到的参数保持 0。"
    ),
    params=AdjustIn,
    handler=adjust_image_exec,
    queued=True,
    session_required=True,
)
