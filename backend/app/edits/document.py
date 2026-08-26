from app.layers import LayerDocument, resolve_layer
from app.ratios import Ratio, parts_of

MIN_CROP = 32


class EditError(Exception):
    """参数合法但无法应用到当前画布，例如裁剪区域过小。"""


def flip(document: LayerDocument, layer_id: str | None, direction: str) -> LayerDocument:
    """就地翻转。x/y 表示未缩放框的左上角，负缩放不移动中心。"""
    doc = document.model_copy(deep=True)
    layer = resolve_layer(doc, layer_id)
    if direction == "horizontal":
        layer.transform.scale_x *= -1
    else:
        layer.transform.scale_y *= -1
    return doc


def set_opacity(document: LayerDocument, layer_id: str | None, opacity: float) -> LayerDocument:
    doc = document.model_copy(deep=True)
    resolve_layer(doc, layer_id).opacity = opacity
    return doc


def scale(
    document: LayerDocument,
    layer_id: str | None,
    *,
    factor: float | None = None,
    scale_x: float | None = None,
    scale_y: float | None = None,
) -> LayerDocument:
    """factor 为相对倍率；scale_x / scale_y 为绝对值，并保留已有翻转方向。"""
    doc = document.model_copy(deep=True)
    transform = resolve_layer(doc, layer_id).transform
    if factor is not None:
        transform.scale_x *= factor
        transform.scale_y *= factor
        return doc
    if scale_x is not None:
        transform.scale_x = _with_sign(transform.scale_x, scale_x)
    if scale_y is not None:
        transform.scale_y = _with_sign(transform.scale_y, scale_y)
    return doc


def rotate(
    document: LayerDocument,
    layer_id: str | None,
    *,
    angle: float | None = None,
    rotation: float | None = None,
) -> LayerDocument:
    doc = document.model_copy(deep=True)
    transform = resolve_layer(doc, layer_id).transform
    transform.rotation = transform.rotation + angle if angle is not None else rotation or 0
    return doc


def reorder(document: LayerDocument, layer_id: str | None, place: str) -> LayerDocument:
    """层表末尾最后绘制，即视觉上的最前。"""
    doc = document.model_copy(deep=True)
    target = resolve_layer(doc, layer_id)
    layers = list(doc.layers)
    index = next(i for i, layer in enumerate(layers) if layer.id == target.id)
    if place == "top":
        layers.append(layers.pop(index))
    elif place == "bottom":
        layers.insert(0, layers.pop(index))
    elif place == "up" and index < len(layers) - 1:
        layers[index], layers[index + 1] = layers[index + 1], layers[index]
    elif place == "down" and index > 0:
        layers[index], layers[index - 1] = layers[index - 1], layers[index]
    doc.layers = layers
    return doc


def crop(
    document: LayerDocument,
    *,
    ratio: Ratio | None = None,
    rect: tuple[float, float, float, float] | None = None,
) -> LayerDocument:
    """裁切画布。图层只平移，像素仍由渲染时按画布边界裁剪。"""
    if ratio is not None:
        left, right = parts_of(ratio)
        x, y, width, height = _fit_ratio(document.width, document.height, left, right)
    elif rect is not None:
        nx, ny, nw, nh = rect
        x, y = nx * document.width, ny * document.height
        width, height = nw * document.width, nh * document.height
    else:
        raise EditError("需要比例或裁剪框")

    x, y, width, height = _as_pixels(x, y, width, height, document.width, document.height)
    if width < MIN_CROP or height < MIN_CROP:
        raise EditError(f"裁剪区域过小，最短边需不小于 {MIN_CROP} 像素")

    doc = document.model_copy(deep=True)
    for layer in doc.layers:
        layer.transform.x -= x
        layer.transform.y -= y
    doc.width = width
    doc.height = height
    return doc


def _with_sign(current: float, magnitude: float) -> float:
    sign = 1 if current >= 0 else -1
    return abs(magnitude) * sign


def _fit_ratio(canvas_w: int, canvas_h: int, rw: int, rh: int) -> tuple[float, float, float, float]:
    if canvas_w * rh >= canvas_h * rw:
        height = float(canvas_h)
        width = height * rw / rh
    else:
        width = float(canvas_w)
        height = width * rh / rw
    return (canvas_w - width) / 2, (canvas_h - height) / 2, width, height


def _as_pixels(
    x: float, y: float, width: float, height: float, canvas_w: int, canvas_h: int
) -> tuple[int, int, int, int]:
    left = max(0, int(round(x)))
    top = max(0, int(round(y)))
    right = min(canvas_w, int(round(x + width)))
    bottom = min(canvas_h, int(round(y + height)))
    return left, top, max(0, right - left), max(0, bottom - top)


__all__ = [
    "EditError",
    "crop",
    "flip",
    "reorder",
    "rotate",
    "scale",
    "set_opacity",
]
