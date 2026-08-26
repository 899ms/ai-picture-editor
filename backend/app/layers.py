"""画布文档结构。工具只修改此文档，像素合成由渲染环节按文档执行。"""

import enum
import uuid

from pydantic import BaseModel, Field

from app.models import Asset

BASE_LAYER_ID = "base"


class LayerKind(enum.StrEnum):
    IMAGE = "image"
    TEXT = "text"
    SHAPE = "shape"


class Transform(BaseModel):
    """相对画布左上角的位置与形变，缩放为倍率而非像素。"""

    x: float = 0
    y: float = 0
    scale_x: float = 1
    scale_y: float = 1
    rotation: float = 0


class Layer(BaseModel):
    id: str
    kind: LayerKind
    name: str
    width: int
    height: int
    asset_id: uuid.UUID | None = None
    transform: Transform = Field(default_factory=Transform)
    opacity: float = 1
    visible: bool = True
    locked: bool = False


class LayerDocument(BaseModel):
    width: int
    height: int
    layers: list[Layer] = Field(default_factory=list)


def document_of(asset: Asset) -> LayerDocument:
    """以整张图片作为底图建立文档。底图锁定，拆层后才会被主体与背景层取代。"""
    return LayerDocument(
        width=asset.width,
        height=asset.height,
        layers=[
            Layer(
                id=BASE_LAYER_ID,
                kind=LayerKind.IMAGE,
                name="底图",
                width=asset.width,
                height=asset.height,
                asset_id=asset.id,
                locked=True,
            )
        ],
    )
