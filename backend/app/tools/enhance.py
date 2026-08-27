from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import AssetKind, AssetSource
from app.models.tool_run import ToolRun
from app.providers import EditRequest, get_image_provider
from app.ratios import Ratio, cover_size
from app.services import assets, runs
from app.tools.base import ToolSpec
from app.tools.context import document_of, flatten_session, require_session


class ReplaceBackgroundIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    count: int = Field(default=1, ge=1, le=4)
    negative_prompt: str | None = None


class ExpandCanvasIn(BaseModel):
    ratio: Ratio
    prompt: str = Field(default="自然延伸画面边缘，保持主体完整", max_length=500)


class UpscaleImageIn(BaseModel):
    scale: int = Field(default=2, ge=2, le=4)


async def _store(
    session: AsyncSession, run: ToolRun, images: list[bytes], *, adopt_first: bool
) -> dict:
    created = [
        await assets.create_from_bytes(
            session, run.user_id, data, AssetKind.GENERATED, AssetSource.TOOL
        )
        for data in images
    ]
    result: dict = {"asset_ids": [str(asset.id) for asset in created]}
    if adopt_first and created:
        result["adopt_asset_id"] = str(created[0].id)
    return result


async def _progress(session: AsyncSession, run: ToolRun, progress: int, stage: str) -> None:
    await runs.report(session, run, progress, stage)


async def replace_background_exec(session: AsyncSession, run: ToolRun) -> dict:
    record = await require_session(session, run)
    await runs.report(session, run, 15, "读取画布")
    source = await flatten_session(session, record)
    await runs.report(session, run, 30, "生成新背景")
    images = await get_image_provider().edit(
        EditRequest(
            prompt=f"只替换背景，保持主体、光线和边缘不变。新背景：{run.params['prompt']}",
            image=source,
            count=run.params["count"],
            negative_prompt=run.params.get("negative_prompt"),
        ),
        on_progress=lambda progress, stage: _progress(session, run, progress, stage),
    )
    if run.params["count"] > 1:
        await runs.report(session, run, 95, "候选已加入图片墙，点选采用")
    return await _store(session, run, images, adopt_first=run.params["count"] == 1)


async def expand_canvas_exec(session: AsyncSession, run: ToolRun) -> dict:
    record = await require_session(session, run)
    canvas = document_of(record)
    width, height = cover_size(canvas.width, canvas.height, Ratio(run.params["ratio"]))
    await runs.report(session, run, 15, "读取画布")
    source = await flatten_session(session, record)
    await runs.report(session, run, 30, "延伸画幅")
    images = await get_image_provider().edit(
        EditRequest(prompt=run.params["prompt"], image=source, width=width, height=height),
        on_progress=lambda progress, stage: _progress(session, run, progress, stage),
    )
    return await _store(session, run, images, adopt_first=True)


async def upscale_image_exec(session: AsyncSession, run: ToolRun) -> dict:
    record = await require_session(session, run)
    await runs.report(session, run, 15, "读取画布")
    source = await flatten_session(session, record)
    await runs.report(session, run, 30, "提升分辨率")
    output = await get_image_provider().upscale(
        source,
        run.params["scale"],
        on_progress=lambda progress, stage: _progress(session, run, progress, stage),
    )
    return await _store(session, run, [output], adopt_first=True)


REPLACE_BACKGROUND = ToolSpec(
    name="replace_background",
    label="换背景",
    description=(
        "保留当前画面主体，按文字描述替换背景。需要新背景的场景描述。"
        "一次可出 1 到 4 张候选；多于一张时不自动上画布，用户点选图片墙采用。"
    ),
    params=ReplaceBackgroundIn,
    handler=replace_background_exec,
    queued=True,
    session_required=True,
    agent_hidden=("negative_prompt",),
)

EXPAND_CANVAS = ToolSpec(
    name="expand_canvas",
    label="扩图",
    description="把当前画布扩展到指定比例，并自然补全新增区域。主体保持完整，不要裁切。",
    params=ExpandCanvasIn,
    handler=expand_canvas_exec,
    queued=True,
    session_required=True,
)

UPSCALE_IMAGE = ToolSpec(
    name="upscale_image",
    label="超分",
    description="提高当前画布分辨率。scale 为 2 或 4，默认 2 倍。不要用它换内容或改构图。",
    params=UpscaleImageIn,
    handler=upscale_image_exec,
    queued=True,
    session_required=True,
)
