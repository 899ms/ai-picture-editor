"""工具注册表。新增工具在此登记即可同时对界面与 Agent 生效。"""

from app.tools.base import ToolSpec, UnknownTool
from app.tools.canvas import (
    CROP_CANVAS,
    FLIP_LAYER,
    REORDER_LAYER,
    ROTATE_LAYER,
    SCALE_LAYER,
    SET_LAYER_OPACITY,
)
from app.tools.enhance import EXPAND_CANVAS, REPLACE_BACKGROUND, UPSCALE_IMAGE
from app.tools.generate import GENERATE_IMAGE
from app.tools.region import ERASE_REGION, REPLACE_REGION
from app.tools.retouch import ADJUST_IMAGE, REMOVE_BACKGROUND

SPECS: tuple[ToolSpec, ...] = (
    GENERATE_IMAGE,
    REPLACE_BACKGROUND,
    EXPAND_CANVAS,
    UPSCALE_IMAGE,
    REMOVE_BACKGROUND,
    ADJUST_IMAGE,
    ERASE_REGION,
    REPLACE_REGION,
    CROP_CANVAS,
    FLIP_LAYER,
    SET_LAYER_OPACITY,
    REORDER_LAYER,
    SCALE_LAYER,
    ROTATE_LAYER,
)

_BY_NAME = {spec.name: spec for spec in SPECS}


def spec_of(name: str) -> ToolSpec:
    spec = _BY_NAME.get(name)
    if spec is None:
        raise UnknownTool(f"未注册的工具：{name}")
    return spec


def label_of(name: str) -> str:
    return _BY_NAME[name].label if name in _BY_NAME else name


__all__ = ["SPECS", "ToolSpec", "UnknownTool", "label_of", "spec_of"]
