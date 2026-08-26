import uuid

import httpx
import pytest
from langchain_core.messages import AIMessage

from app.agent import graph
from app.agent.llm import planner
from app.config import get_settings
from app.tasks.tools import run_tool
from tests.test_sessions import open_session

PROMPT = {"prompt": "浅木色桌面上的白色马克杯", "ratio": "1:1", "count": 2}


class FakePlanner:
    def __init__(self, message: AIMessage) -> None:
        self._message = message

    async def ainvoke(self, messages):
        self.messages = messages
        return self._message


@pytest.fixture
def fake_planner(monkeypatch):
    def install(message: AIMessage) -> FakePlanner:
        fake = FakePlanner(message)
        monkeypatch.setattr(graph, "planner", lambda: fake)
        return fake

    return install


def tool_call(name: str, args: dict) -> AIMessage:
    return AIMessage(content="", tool_calls=[{"name": name, "args": args, "id": "call_1"}])


@pytest.fixture
async def signed_in(client: httpx.AsyncClient, credentials):
    await client.post("/api/auth/register", json=credentials)
    return client


async def send(client: httpx.AsyncClient, session_id: str, text: str) -> dict:
    response = await client.post(f"/api/sessions/{session_id}/messages", json={"text": text})
    assert response.status_code == 201, response.text
    return response.json()


async def test_tool_call_is_planned_and_dispatched(signed_in: httpx.AsyncClient, fake_planner):
    fake_planner(tool_call("generate_image", PROMPT))
    session_id = (await open_session(signed_in))["id"]

    turn = await send(signed_in, session_id, "换一张白底马克杯")

    assert turn["status"] == "succeeded"
    assert [step["tool"] for step in turn["steps"]] == ["generate_image"]
    assert turn["steps"][0]["label"] == "生成图片"
    assert turn["steps"][0]["run_id"]
    assert turn["reply"]


async def test_plain_answer_dispatches_nothing(signed_in: httpx.AsyncClient, fake_planner):
    fake_planner(AIMessage(content="现有工具做不到这个。"))
    session_id = (await open_session(signed_in))["id"]

    turn = await send(signed_in, session_id, "帮我写一首诗")

    assert turn["steps"] == []
    assert turn["reply"] == "现有工具做不到这个。"


async def test_canvas_facts_are_given_to_the_planner(signed_in: httpx.AsyncClient, fake_planner):
    fake = fake_planner(AIMessage(content="好的。"))
    session_id = (await open_session(signed_in))["id"]

    await send(signed_in, session_id, "看看这张图")

    system = fake.messages[0].content
    assert "画幅 320×240" in system
    assert "修订号 1" in system


async def test_unregistered_tool_is_refused(signed_in: httpx.AsyncClient, fake_planner):
    fake_planner(tool_call("teleport_subject", {}))
    session_id = (await open_session(signed_in))["id"]

    turn = await send(signed_in, session_id, "把主体传送走")

    assert turn["steps"] == []
    assert "执行不了" in turn["reply"]


async def test_illegal_params_are_refused(signed_in: httpx.AsyncClient, fake_planner):
    fake_planner(tool_call("generate_image", {"prompt": "  ", "count": 99}))
    session_id = (await open_session(signed_in))["id"]

    turn = await send(signed_in, session_id, "随便来一张")

    assert turn["steps"] == []
    assert "执行不了" in turn["reply"]


async def test_results_join_the_wall_without_switching_current(
    signed_in: httpx.AsyncClient, fake_planner
):
    fake_planner(tool_call("generate_image", PROMPT))
    session = await open_session(signed_in)
    turn = await send(signed_in, session["id"], "换一张")

    await run_tool({}, uuid.UUID(turn["steps"][0]["run_id"]))

    updated = (await signed_in.get(f"/api/sessions/{session['id']}")).json()
    assert len(updated["assets"]) == 3
    assert updated["current_asset_id"] == session["current_asset_id"]
    assert updated["revision"] == 1

    history = (await signed_in.get(f"/api/sessions/{session['id']}/history")).json()
    assert history[0]["action"] == "generate_image"


async def test_conversation_is_returned_in_order(signed_in: httpx.AsyncClient, fake_planner):
    fake_planner(AIMessage(content="好的。"))
    session_id = (await open_session(signed_in))["id"]

    await send(signed_in, session_id, "第一句")
    await send(signed_in, session_id, "第二句")

    turns = (await signed_in.get(f"/api/sessions/{session_id}/messages")).json()
    assert [turn["goal"] for turn in turns] == ["第一句", "第二句"]


async def test_missing_api_key_fails_the_turn(signed_in: httpx.AsyncClient, monkeypatch):
    """模型不可用时必须明确失败，不能伪造成功结果。"""
    settings = get_settings()
    monkeypatch.setattr(settings, "dashscope_api_key", "")
    planner.cache_clear()
    session_id = (await open_session(signed_in))["id"]

    turn = await send(signed_in, session_id, "换个背景")

    planner.cache_clear()
    assert turn["status"] == "failed"
    assert "DASHSCOPE_API_KEY" in turn["error"]


async def test_blank_message_is_rejected(signed_in: httpx.AsyncClient):
    session_id = (await open_session(signed_in))["id"]

    response = await signed_in.post(f"/api/sessions/{session_id}/messages", json={"text": "   "})

    assert response.status_code == 422


async def test_messages_require_authentication(client: httpx.AsyncClient):
    path = f"/api/sessions/{uuid.uuid4()}/messages"

    assert (await client.get(path)).status_code == 401
    assert (await client.post(path, json={"text": "你好"})).status_code == 401
