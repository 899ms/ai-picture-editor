import hashlib
import io

from PIL import Image, ImageChops

from app.edits.mask import overlay_png, to_luma
from app.edits.ocr import TextBox
from app.layers import (
    BACKGROUND_LAYER_ID,
    BASE_LAYER_ID,
    SUBJECT_LAYER_ID,
    Layer,
    LayerDocument,
    LayerKind,
    Transform,
)


class EmptyCut(Exception):
    """遮罩没有覆盖到任何像素。"""


def mask_hash(mask: bytes) -> str:
    return hashlib.sha256(to_luma(mask).tobytes()).hexdigest()[:16]


def already_split(document: LayerDocument) -> bool:
    ids = {layer.id for layer in document.layers}
    if BACKGROUND_LAYER_ID in ids and SUBJECT_LAYER_ID in ids:
        return True
    return BACKGROUND_LAYER_ID in ids and BASE_LAYER_ID not in ids


def already_promoted(document: LayerDocument, key: str) -> bool:
    return any(layer.source_hash == key for layer in document.layers)


def cut_object(source: bytes, mask: bytes) -> tuple[bytes, int, int, int, int]:
    """按遮罩抠出物体，返回裁切后的 PNG 与画布坐标。"""
    image = Image.open(io.BytesIO(source)).convert("RGBA")
    luma = to_luma(mask, image.size)
    alpha = ImageChops.multiply(image.getchannel("A"), luma)
    image.putalpha(alpha)
    box = luma.getbbox()
    if box is None:
        raise EmptyCut
    cropped = image.crop(box)
    left, top, right, bottom = box
    return _png(cropped), left, top, right - left, bottom - top


def punch(source: bytes, mask: bytes, *, x: float = 0, y: float = 0) -> bytes:
    """把遮罩覆盖到的像素打成透明。mask 为画布尺寸，x/y 是图层原点。"""
    image = Image.open(io.BytesIO(source)).convert("RGBA")
    luma = to_luma(mask)
    left, top = int(round(x)), int(round(y))
    local = Image.new("L", image.size, 0)
    local.paste(luma, (-left, -top))
    keep = ImageChops.invert(local)
    image.putalpha(ImageChops.multiply(image.getchannel("A"), keep))
    return _png(image)


def alpha_mask(data: bytes) -> bytes:
    """把透明通道做成可视化遮罩，供局部合成复用。"""
    alpha = Image.open(io.BytesIO(data)).convert("RGBA").getchannel("A")
    return overlay_png(alpha)


def split_document(
    document: LayerDocument,
    *,
    background_id,
    subject_id,
    texts: list[TextBox],
    subject_hash: str | None = None,
) -> LayerDocument:
    layers = [
        Layer(
            id=BACKGROUND_LAYER_ID,
            kind=LayerKind.IMAGE,
            name="背景",
            width=document.width,
            height=document.height,
            asset_id=background_id,
            locked=True,
        ),
        Layer(
            id=SUBJECT_LAYER_ID,
            kind=LayerKind.IMAGE,
            name="主体",
            width=document.width,
            height=document.height,
            asset_id=subject_id,
            source_hash=subject_hash,
        ),
        *[_text_layer(index, box) for index, box in enumerate(texts, start=1)],
    ]
    return LayerDocument(width=document.width, height=document.height, layers=layers)


def promote_document(
    document: LayerDocument,
    *,
    asset_id,
    x: int,
    y: int,
    width: int,
    height: int,
    source_hash: str,
    replacements: dict[str, object],
) -> LayerDocument:
    doc = document.model_copy(deep=True)
    for layer in doc.layers:
        next_id = replacements.get(layer.id)
        if next_id is not None:
            layer.asset_id = next_id
    count = sum(1 for layer in doc.layers if layer.source_hash)
    doc.layers.append(
        Layer(
            id=f"object-{source_hash}",
            kind=LayerKind.IMAGE,
            name=f"物体{count + 1}",
            width=width,
            height=height,
            asset_id=asset_id,
            transform=Transform(x=x, y=y),
            source_hash=source_hash,
        )
    )
    return doc


def as_background_and_object(
    document: LayerDocument,
    *,
    background_id,
    object_id,
    x: int,
    y: int,
    width: int,
    height: int,
    source_hash: str,
    texts: list[TextBox] | None = None,
) -> LayerDocument:
    layers = [
        Layer(
            id=BACKGROUND_LAYER_ID,
            kind=LayerKind.IMAGE,
            name="背景",
            width=document.width,
            height=document.height,
            asset_id=background_id,
            locked=True,
        ),
        Layer(
            id=f"object-{source_hash}",
            kind=LayerKind.IMAGE,
            name="物体1",
            width=width,
            height=height,
            asset_id=object_id,
            transform=Transform(x=x, y=y),
            source_hash=source_hash,
        ),
        *[_text_layer(index, box) for index, box in enumerate(texts or [], start=1)],
    ]
    return LayerDocument(width=document.width, height=document.height, layers=layers)


def _text_layer(index: int, box: TextBox) -> Layer:
    return Layer(
        id=f"text-{index}",
        kind=LayerKind.TEXT,
        name=box.text[:12] or f"文字{index}",
        width=box.width,
        height=box.height,
        transform=Transform(x=box.x, y=box.y),
        text=box.text,
        font_size=max(10, box.height * 0.72),
    )


def _png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
