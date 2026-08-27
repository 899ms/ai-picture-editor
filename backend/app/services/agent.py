import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import agent
from app.layers import Layer, LayerDocument, LayerKind
from app.models import AgentRun, EditSession
from app.models.tool_run import RunStatus
from app.services import assets, selections

logger = logging.getLogger(__name__)


async def describe(session: AsyncSession, record: EditSession) -> str:
    """给规划模型的画布摘要，只给决策必需的事实。"""
    document = LayerDocument.model_validate(record.document)
    names = [_layer_name(layer) for layer in document.layers]
    parts = [
        f"画幅 {document.width}×{document.height}",
        f"图层 {len(document.layers)} 个（{'、'.join(names)}）",
        "未指定图层时，调色/去背/翻转/移动作用在最上层图像，换背景作用在背景层",
        f"修订号 {record.revision}",
    ]

    current = await assets.get_for_user(session, record.user_id, record.current_asset_id)
    if current is not None:
        parts.append(f"当前图 {current.image_format}{'，含透明通道' if current.has_alpha else ''}")

    selected = await selections.get(record.id, record.revision)
    if selected:
        markers = selected.get("markers") or []
        parts.append(f"已有选区，{len(markers)} 个标点" if markers else "已有笔刷选区")
    else:
        parts.append("当前无选区")
    return "；".join(parts)


def _layer_name(layer: Layer) -> str:
    name = f"文字「{layer.text[:8]}」" if layer.kind is LayerKind.TEXT and layer.text else layer.name
    return name if layer.visible else f"{name}·隐藏"


async def respond(session: AsyncSession, record: EditSession, goal: str) -> AgentRun:
    """规划一轮指令并落库。规划失败也记录成一轮对话，不对用户隐瞒失败。"""
    revision = record.revision
    reply, plan, error = "", [], None

    try:
        deps = agent.AgentDeps(session=session, user_id=record.user_id, session_id=record.id)
        reply, plan = await agent.run(goal, await describe(session, record), deps)
    except agent.PlannerUnavailable as exc:
        error = str(exc)
    except Exception:
        logger.exception("指令规划异常 session_id=%s", record.id)
        await session.rollback()
        error = "规划失败，请重试"

    turn = AgentRun(
        user_id=record.user_id,
        session_id=record.id,
        revision=revision,
        goal=goal,
        reply=reply,
        plan=plan,
        status=RunStatus.FAILED if error else RunStatus.SUCCEEDED,
        error=error,
    )
    session.add(turn)
    await session.commit()
    await session.refresh(turn)
    return turn


async def turns_of(session: AsyncSession, record: EditSession, limit: int = 50) -> list[AgentRun]:
    result = await session.scalars(
        select(AgentRun)
        .where(AgentRun.session_id == record.id)
        .order_by(AgentRun.created_at)
        .limit(limit)
    )
    return list(result)
