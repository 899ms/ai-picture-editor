from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app import storage
from app.edits.mask import overlay_png, to_luma
from app.edits.split import EmptyCut
from app.layers import (
    BACKGROUND_LAYER_ID,
    Layer,
    LayerDocument,
    LayerKind,
    resolve_layer,
)
from app.models import EditSession, ToolRun
from app.models.asset import AssetKind, AssetSource
from app.services import assets
from app.tools.context import ToolError, document_of


async def layer_image(session: AsyncSession, record: EditSession, layer: Layer) -> bytes:
    if layer.kind is not LayerKind.IMAGE or layer.asset_id is None:
        raise ToolError("该图层没有可处理的图像")
    asset = await assets.get_for_user(session, record.user_id, layer.asset_id)
    if asset is None:
        raise ToolError("图层素材不存在")
    return await storage.get(asset.storage_key)


async def write_layer_image(
    session: AsyncSession,
    run: ToolRun,
    record: EditSession,
    layer_id: str | None,
    data: bytes,
    kind: AssetKind,
) -> dict:
    """把处理结果写回指定图层，多层时不拍平、不切换当前图。"""
    document = document_of(record).model_copy(deep=True)
    layer = resolve_layer(document, layer_id)
    if layer.kind is not LayerKind.IMAGE:
        raise ToolError("只能对图像图层做此操作")
    asset = await assets.create_from_bytes(session, run.user_id, data, kind, AssetSource.TOOL)
    layer.asset_id = asset.id
    result: dict = {
        "document": document.model_dump(mode="json"),
        "asset_ids": [str(asset.id)],
    }
    if _single_image(document):
        result["adopt_asset_id"] = str(asset.id)
    return result


def background_target(document: LayerDocument) -> Layer:
    for layer in document.layers:
        if layer.id == BACKGROUND_LAYER_ID and layer.kind is LayerKind.IMAGE:
            return layer
    return resolve_layer(document, None)


def layer_under_mask(document: LayerDocument, mask: bytes) -> Layer:
    """选区覆盖到的最上层图像；没有交集时退回默认图层。"""
    luma = to_luma(mask, (document.width, document.height))
    box = luma.getbbox()
    if box is None:
        return resolve_layer(document, None)
    left, top, right, bottom = box
    for layer in reversed(document.layers):
        if layer.kind is not LayerKind.IMAGE or not layer.visible:
            continue
        x, y = layer.transform.x, layer.transform.y
        if right > x and left < x + layer.width and bottom > y and top < y + layer.height:
            return layer
    return resolve_layer(document, None)


def mask_for_layer(mask: bytes, layer: Layer, canvas: tuple[int, int]) -> bytes:
    luma = to_luma(mask, canvas)
    local = Image.new("L", (layer.width, layer.height), 0)
    local.paste(luma, (-int(round(layer.transform.x)), -int(round(layer.transform.y))))
    if local.getbbox() is None:
        raise EmptyCut
    return overlay_png(local)


def _single_image(document: LayerDocument) -> bool:
    return sum(1 for layer in document.layers if layer.kind is LayerKind.IMAGE) <= 1
