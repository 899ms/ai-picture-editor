from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.edits.mask import apply_masked
from app.edits.split import EmptyCut
from app.layers import resolve_layer
from app.models.asset import AssetKind
from app.models.tool_run import ToolRun
from app.providers import EditRequest, get_image_provider
from app.services import runs, selections
from app.services.selections import EmptySelection, StaleSelection
from app.tools.base import ToolSpec
from app.tools.context import ToolError, document_of, require_session
from app.tools.target import layer_image, layer_under_mask, mask_for_layer, write_layer_image


class RegionIn(BaseModel):
    prompt: str = Field(default="", max_length=500)
    layer_id: str | None = None
    mask_asset_id: str | None = None
    revision: int | None = None


class ReplaceRegionIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    layer_id: str | None = None
    mask_asset_id: str | None = None
    revision: int | None = None


async def _edit_region(session: AsyncSession, run: ToolRun, prompt: str) -> dict:
    record = await require_session(session, run)
    if run.params.get("revision") not in (None, record.revision):
        raise ToolError("选区已过期，请重新选择")
    try:
        mask = await selections.mask_bytes(session, record, run.params.get("mask_asset_id"))
    except (EmptySelection, StaleSelection) as exc:
        raise ToolError("请先点选或涂抹要修改的区域") from exc

    document = document_of(record)
    layer = (
        resolve_layer(document, run.params["layer_id"])
        if run.params.get("layer_id")
        else layer_under_mask(document, mask)
    )
    try:
        local_mask = mask_for_layer(mask, layer, (document.width, document.height))
    except EmptyCut as exc:
        raise ToolError("选区没有覆盖到该图层") from exc

    await runs.report(session, run, 20, "读取选区")
    source = await layer_image(session, record, layer)
    await runs.report(session, run, 40, "局部生成")
    edited = (
        await get_image_provider().edit(
            EditRequest(prompt=prompt, image=source),
            on_progress=lambda progress, stage: runs.report(session, run, progress, stage),
        )
    )[0]
    await runs.report(session, run, 85, "合并选区")
    output = apply_masked(source, edited, local_mask)
    await selections.clear(record.id)
    return await write_layer_image(session, run, record, layer.id, output, AssetKind.GENERATED)


async def erase_region_exec(session: AsyncSession, run: ToolRun) -> dict:
    prompt = run.params.get("prompt") or (
        "移除选中物体，用周围背景自然填补，不要改变选区以外的画面。"
    )
    return await _edit_region(session, run, prompt)


async def replace_region_exec(session: AsyncSession, run: ToolRun) -> dict:
    prompt = (
        f"只改选中区域：{run.params['prompt']}。"
        "选区外的主体、光线和背景必须保持原样。"
    )
    return await _edit_region(session, run, prompt)


_HIDDEN = ("layer_id", "mask_asset_id", "revision")

ERASE_REGION = ToolSpec(
    name="erase_region",
    label="局部消除",
    description="消除当前选区内的物体，并用周围内容自然填补。画布摘要标明已有选区时即可调用。",
    params=RegionIn,
    handler=erase_region_exec,
    queued=True,
    session_required=True,
    agent_hidden=_HIDDEN,
)

REPLACE_REGION = ToolSpec(
    name="replace_region",
    label="局部替换",
    description="按文字描述替换当前选区内的内容。画布摘要标明已有选区时即可调用，只需给出替换描述。",
    params=ReplaceRegionIn,
    handler=replace_region_exec,
    queued=True,
    session_required=True,
    agent_hidden=_HIDDEN,
)
