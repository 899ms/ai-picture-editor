import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.llm import planner
from app.services import tools as tool_service
from app.tools import UnknownTool, label_of, spec_of

_SYSTEM = """你是电商图片修图助手，通过调用工具完成用户的修图请求。

规则：
- 只能使用已提供的工具，本轮最多安排一步。
- 缺失参数用画布信息与常识补齐，可推断的参数不要反问用户。
- 画布摘要标明已有选区时，局部消除/替换可直接调用，不要再让用户重选。
- 指令与修图无关，或现有工具做不到时，用一句中文说明原因，不要调用工具。

当前画布：{context}"""

_FALLBACK_REPLY = "没太理解这条指令，换个说法或说得更具体一些。"


@dataclass(frozen=True)
class AgentDeps:
    """图执行所需的运行时依赖。不放进 state，以便后续接入 checkpoint。"""

    session: AsyncSession
    user_id: uuid.UUID
    session_id: uuid.UUID


class AgentState(TypedDict):
    goal: str
    context: str
    plan: list[dict]
    reply: str


async def _plan(state: AgentState) -> AgentState:
    message = await planner().ainvoke(
        [
            SystemMessage(_SYSTEM.format(context=state["context"])),
            HumanMessage(state["goal"]),
        ]
    )
    return {
        "plan": [{"tool": call["name"], "params": call["args"]} for call in message.tool_calls],
        "reply": _text_of(message),
    }


def _verify(state: AgentState) -> AgentState:
    """模型给出的计划一律经服务端校验，不可直接执行。"""
    checked: list[dict] = []
    for step in state["plan"]:
        try:
            spec = spec_of(step["tool"])
            params = tool_service.validate(spec.name, step["params"])
        except (UnknownTool, tool_service.InvalidParams) as exc:
            return {"plan": [], "reply": f"这一步暂时执行不了：{exc}"}
        checked.append({"tool": spec.name, "params": params})
    return {"plan": checked}


async def _dispatch(state: AgentState, config: RunnableConfig) -> AgentState:
    deps: AgentDeps = config["configurable"]["deps"]

    plan: list[dict] = []
    for step in state["plan"]:
        run = await tool_service.submit(
            deps.session, deps.user_id, step["tool"], step["params"], deps.session_id
        )
        plan.append(step | {"run_id": str(run.id)})

    labels = "、".join(label_of(step["tool"]) for step in plan)
    return {"plan": plan, "reply": state["reply"] or f"好，正在{labels}。"}


def _has_plan(state: AgentState) -> str:
    return "dispatch" if state["plan"] else END


@lru_cache
def _graph():
    builder = StateGraph(AgentState)
    builder.add_node("plan", _plan)
    builder.add_node("verify", _verify)
    builder.add_node("dispatch", _dispatch)

    builder.add_edge(START, "plan")
    builder.add_edge("plan", "verify")
    builder.add_conditional_edges("verify", _has_plan, {"dispatch": "dispatch", END: END})
    builder.add_edge("dispatch", END)
    return builder.compile()


async def run(goal: str, context: str, deps: AgentDeps) -> tuple[str, list[dict]]:
    """规划并下发一轮指令，返回给用户的答复与已下发的计划。"""
    state = await _graph().ainvoke(
        {"goal": goal, "context": context, "plan": [], "reply": ""},
        config={"configurable": {"deps": deps}},
    )
    return state["reply"] or _FALLBACK_REPLY, state["plan"]


def _text_of(message: AIMessage) -> str:
    if isinstance(message.content, str):
        return message.content.strip()
    # 部分模型返回分块内容，只取文本块
    return "".join(
        block.get("text", "") for block in message.content if isinstance(block, dict)
    ).strip()
