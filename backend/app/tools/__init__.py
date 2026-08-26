"""工具注册表。新增工具在此登记即可同时对界面与 Agent 生效。"""

from app.tools.base import ToolSpec, UnknownTool
from app.tools.generate import GENERATE_IMAGE

SPECS: tuple[ToolSpec, ...] = (GENERATE_IMAGE,)

_BY_NAME = {spec.name: spec for spec in SPECS}


def spec_of(name: str) -> ToolSpec:
    spec = _BY_NAME.get(name)
    if spec is None:
        raise UnknownTool(f"未注册的工具：{name}")
    return spec


def label_of(name: str) -> str:
    return _BY_NAME[name].label if name in _BY_NAME else name


__all__ = ["GENERATE_IMAGE", "SPECS", "ToolSpec", "UnknownTool", "label_of", "spec_of"]
