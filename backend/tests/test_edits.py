import uuid
from io import BytesIO

from PIL import Image

from app.edits.document import crop, flip, reorder, rotate, scale, set_opacity
from app.edits.pixels import adjust, remove_background
from app.edits.render import TRANSPARENT, flatten
from app.layers import BASE_LAYER_ID, Layer, LayerDocument, LayerKind, Transform
from app.providers.dashscope import _fit_edit_size
from app.ratios import Ratio, cover_size


def _doc(width=400, height=500, **transform) -> LayerDocument:
    return LayerDocument(
        width=width,
        height=height,
        layers=[
            Layer(
                id=BASE_LAYER_ID,
                kind=LayerKind.IMAGE,
                name="底图",
                width=width,
                height=height,
                transform=Transform(**transform),
            )
        ],
    )


def test_flip_negates_scale_in_place():
    flipped = flip(_doc(), None, "horizontal")

    assert flipped.layers[0].transform.scale_x == -1
    assert flipped.layers[0].transform.x == 0


def test_scale_factor_keeps_flip_direction():
    flipped = flip(_doc(), None, "horizontal")

    scaled = scale(flipped, None, factor=0.5)

    assert scaled.layers[0].transform.scale_x == -0.5
    assert scaled.layers[0].transform.scale_y == 0.5


def test_absolute_scale_preserves_sign():
    flipped = flip(_doc(), None, "vertical")

    scaled = scale(flipped, None, scale_y=2)

    assert scaled.layers[0].transform.scale_y == -2


def test_rotate_can_be_relative_or_absolute():
    turned = rotate(_doc(), None, angle=8)
    assert turned.layers[0].transform.rotation == 8

    reset = rotate(turned, None, rotation=-15)
    assert reset.layers[0].transform.rotation == -15


def test_opacity_is_absolute():
    assert set_opacity(_doc(), None, 0.4).layers[0].opacity == 0.4


def test_reorder_moves_named_layer_to_top():
    document = LayerDocument(
        width=100,
        height=100,
        layers=[
            Layer(id="a", kind=LayerKind.IMAGE, name="A", width=100, height=100),
            Layer(id="b", kind=LayerKind.IMAGE, name="B", width=100, height=100),
        ],
    )

    assert [layer.id for layer in reorder(document, "a", "top").layers] == ["b", "a"]
    assert [layer.id for layer in reorder(document, "b", "down").layers] == ["b", "a"]


def test_crop_to_ratio_is_centered():
    cropped = crop(_doc(400, 500), ratio=Ratio.SQUARE)

    assert (cropped.width, cropped.height) == (400, 400)
    assert cropped.layers[0].transform.y == -50


def test_crop_normalized_rect_shifts_layers():
    cropped = crop(_doc(200, 200), rect=(0.25, 0.25, 0.5, 0.5))

    assert (cropped.width, cropped.height) == (100, 100)
    assert (cropped.layers[0].transform.x, cropped.layers[0].transform.y) == (-50, -50)


def _png(color, size=(80, 80), box=None) -> bytes:
    image = Image.new("RGBA", size, color)
    if box:
        Image.Image.paste(
            image,
            Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (200, 30, 30, 255)),
            box[:2],
        )
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_flatten_clips_to_canvas_and_honors_opacity():
    asset_id = uuid.uuid4()
    document = crop(_doc(80, 80), rect=(0.25, 0.25, 0.5, 0.5))
    document.layers[0].asset_id = asset_id
    document.layers[0].opacity = 0.5
    raw = _png((10, 80, 200, 255), (80, 80))

    flat = Image.open(BytesIO(flatten(document, {asset_id: raw})))

    assert flat.size == (40, 40)
    # 半透明叠在白底上，通道应介于原色与 255 之间
    assert 10 < flat.getpixel((20, 20))[0] < 255


def test_remove_background_clears_corner_color():
    data = _png((255, 255, 255, 255), (64, 64), box=(16, 16, 48, 48))

    result = Image.open(BytesIO(remove_background(data)))

    assert result.getpixel((2, 2))[3] == 0
    assert result.getpixel((32, 32))[3] == 255


def test_adjust_brightness_lightens_pixels():
    data = _png((80, 80, 80, 255), (48, 48))
    bright = Image.open(BytesIO(adjust(data, brightness=0.4)))

    assert bright.getpixel((8, 8))[0] > 80


def test_adjust_preserves_transparent_pixels():
    data = _png((0, 0, 0, 0), (64, 64), box=(16, 16, 48, 48))
    result = Image.open(BytesIO(adjust(data, brightness=-0.7, contrast=-0.6)))

    assert result.getpixel((2, 2))[3] == 0
    assert result.getpixel((32, 32))[3] == 255
    assert result.getpixel((32, 32))[0] > 0


def test_adjust_vignette_darkens_corners():
    data = _png((200, 180, 160, 255), (64, 64))
    result = Image.open(BytesIO(adjust(data, vignette=0.8)))

    assert result.getpixel((2, 2))[0] < result.getpixel((32, 32))[0]


def test_dashscope_edit_size_stays_within_model_limits():
    assert min(_fit_edit_size(426, 240)) >= 512
    assert max(_fit_edit_size(8000, 4000)) <= 2048


def test_cover_size_grows_the_shorter_edge_to_the_ratio():
    assert cover_size(320, 240, Ratio.LANDSCAPE_16_9) == (426, 240)
    assert cover_size(320, 240, Ratio.SQUARE) == (320, 320)
    assert cover_size(240, 320, Ratio.SQUARE) == (320, 320)


def test_flatten_can_keep_transparent_background():
    asset_id = uuid.uuid4()
    document = _doc(80, 80)
    document.layers[0].asset_id = asset_id
    raw = _png((0, 0, 0, 0), (80, 80), box=(20, 20, 60, 60))

    flat = Image.open(BytesIO(flatten(document, {asset_id: raw}, background=TRANSPARENT)))

    assert flat.getpixel((4, 4))[3] == 0
    assert flat.getpixel((40, 40))[3] == 255
