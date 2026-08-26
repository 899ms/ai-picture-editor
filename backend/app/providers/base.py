from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Protocol

ProgressCallback = Callable[[int, str], Awaitable[None]]


class ProviderError(Exception):
    """模型服务不可用或返回失败。"""


@dataclass(frozen=True)
class GenerateRequest:
    prompt: str
    width: int
    height: int
    count: int = 1
    negative_prompt: str | None = None
    seed: int | None = None
    # 参考图以原始字节传入，由各 adapter 决定编码方式
    references: list[bytes] = field(default_factory=list)


class ImageProvider(Protocol):
    name: str

    async def generate(
        self, request: GenerateRequest, on_progress: ProgressCallback | None = None
    ) -> list[bytes]:
        """返回 count 张图片的原始字节。失败时抛出 ProviderError。"""
        ...
