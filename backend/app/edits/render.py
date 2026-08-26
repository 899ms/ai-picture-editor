import io
import uuid

from PIL import Image, ImageOps

from app.layers import Layer, LayerDocument, LayerKind


def flatten(document: LayerDocument, images: dict[uuid.UUID, bytes]) -> bytes:
    """按文档合成一张 PNG。旋转绕图层中心，与画布渲染一致。"""
    canvas = Image.new("RGBA", (document.width, document.height), (255, 255, 255, 255))
    for layer in document.layers:
        if not layer.visible or layer.kind is not LayerKind.IMAGE or layer.asset_id is None:
            continue
        raw = images.get(layer.asset_id)
        if raw is None:
            continue
        _composite(canvas, layer, raw)

    buffer = io.BytesIO()
    canvas.save(buffer, format="PNG")
    return buffer.getvalue()


def _composite(canvas: Image.Image, layer: Layer, raw: bytes) -> None:
    source = Image.open(io.BytesIO(raw)).convert("RGBA")
    source = source.resize((layer.width, layer.height), Image.Resampling.LANCZOS)

    transform = layer.transform
    if transform.scale_x < 0:
        source = ImageOps.mirror(source)
    if transform.scale_y < 0:
        source = ImageOps.flip(source)

    width = max(1, int(round(layer.width * abs(transform.scale_x))))
    height = max(1, int(round(layer.height * abs(transform.scale_y))))
    if source.size != (width, height):
        source = source.resize((width, height), Image.Resampling.LANCZOS)

    if layer.opacity < 1:
        alpha = source.getchannel("A").point(lambda value: int(value * layer.opacity))
        source.putalpha(alpha)

    if transform.rotation:
        # Pillow 逆时针为正，画布旋转顺时针为正
        source = source.rotate(-transform.rotation, expand=True, resample=Image.Resampling.BICUBIC)

    center_x = transform.x + layer.width / 2
    center_y = transform.y + layer.height / 2
    left = int(round(center_x - source.width / 2))
    top = int(round(center_y - source.height / 2))
    _paste(canvas, source, left, top)


def _paste(canvas: Image.Image, source: Image.Image, left: int, top: int) -> None:
    src_x, src_y = max(0, -left), max(0, -top)
    dst_x, dst_y = max(0, left), max(0, top)
    width = min(source.width - src_x, canvas.width - dst_x)
    height = min(source.height - src_y, canvas.height - dst_y)
    if width <= 0 or height <= 0:
        return
    piece = source.crop((src_x, src_y, src_x + width, src_y + height))
    canvas.alpha_composite(piece, (dst_x, dst_y))
