from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ToolRun

ToolHandler = Callable[[AsyncSession, ToolRun], Awaitable[dict]]


class UnknownTool(Exception):
    pass


@dataclass(frozen=True)
class ToolSpec:
    """一个工具的完整定义，界面与 Agent 共用。

    params 同时用于服务端校验和生成模型的函数签名，两者不会漂移。
    handler 只关心业务结果，状态流转由统一的执行外壳负责。
    """

    name: str
    label: str
    description: str
    params: type[BaseModel]
    handler: ToolHandler
    needs_approval: bool = False
    # 素材 ID、随机种子这类参数应由服务端从上下文填入，不暴露给模型
    agent_hidden: tuple[str, ...] = field(default_factory=tuple)
