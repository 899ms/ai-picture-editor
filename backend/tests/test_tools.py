import uuid

import httpx
import pytest
from langchain_core.messages import AIMessage

from app.agent import graph
from app.tasks.tools import run_tool
from tests.test_agent import FakePlanner
from tests.test_sessions import open_session


@pytest.fixture
async def signed_in(client: httpx.AsyncClient, credentials):
    await client.post("/api/auth/register", json=credentials)
    return client


async def invoke(client: httpx.AsyncClient, session_id: str, tool: str, params: dict | None = None):
    response = await client.post(
        f"/api/sessions/{session_id}/tools", json={"tool": tool, "params": params or {}}
    )
    assert response.status_code == 202, response.text
    return response.json()


async def test_flip_updates_document_immediately(signed_in: httpx.AsyncClient):
    session_id = (await open_session(signed_in))["id"]

    body = await invoke(signed_in, session_id, "flip_layer", {"direction": "horizontal"})

    assert body["run"]["status"] == "succeeded"
    assert body["session"]["document"]["layers"][0]["transform"]["scale_x"] == -1
    assert body["session"]["revision"] == 2
    assert body["session"]["can_undo"] is True


async def test_crop_to_square_changes_canvas(signed_in: httpx.AsyncClient):
    session = await open_session(signed_in)

    body = await invoke(signed_in, session["id"], "crop_canvas", {"ratio": "1:1"})
    document = body["session"]["document"]

    assert document["width"] == document["height"] == 240
    assert document["layers"][0]["transform"]["x"] == -40


async def test_opacity_and_scale_and_rotate(signed_in: httpx.AsyncClient):
    session_id = (await open_session(signed_in))["id"]

    await invoke(signed_in, session_id, "set_layer_opacity", {"opacity": 0.6})
    await invoke(signed_in, session_id, "scale_layer", {"factor": 0.5})
    body = await invoke(signed_in, session_id, "rotate_layer", {"angle": 15})

    layer = body["session"]["document"]["layers"][0]
    assert layer["opacity"] == 0.6
    assert layer["transform"]["scale_x"] == 0.5
    assert layer["transform"]["rotation"] == 15


async def test_undo_restores_previous_document_and_redo_replays(
    signed_in: httpx.AsyncClient,
):
    session_id = (await open_session(signed_in))["id"]
    await invoke(signed_in, session_id, "flip_layer", {"direction": "vertical"})

    undone = (await signed_in.post(f"/api/sessions/{session_id}/undo")).json()
    assert undone["document"]["layers"][0]["transform"]["scale_y"] == 1
    assert undone["can_undo"] is False
    assert undone["can_redo"] is True

    redone = (await signed_in.post(f"/api/sessions/{session_id}/redo")).json()
    assert redone["document"]["layers"][0]["transform"]["scale_y"] == -1
    assert redone["can_redo"] is False


async def test_new_edit_after_undo_drops_redo_branch(signed_in: httpx.AsyncClient):
    session_id = (await open_session(signed_in))["id"]
    await invoke(signed_in, session_id, "flip_layer", {"direction": "horizontal"})
    await signed_in.post(f"/api/sessions/{session_id}/undo")
    await invoke(signed_in, session_id, "rotate_layer", {"angle": 10})

    session = (await signed_in.get(f"/api/sessions/{session_id}")).json()
    assert session["can_redo"] is False
    assert session["document"]["layers"][0]["transform"]["rotation"] == 10
    assert session["document"]["layers"][0]["transform"]["scale_x"] == 1


async def test_undo_at_start_is_rejected(signed_in: httpx.AsyncClient):
    session_id = (await open_session(signed_in))["id"]

    response = await signed_in.post(f"/api/sessions/{session_id}/undo")

    assert response.status_code == 409


async def test_unknown_and_invalid_tools_are_rejected(signed_in: httpx.AsyncClient):
    session_id = (await open_session(signed_in))["id"]

    unknown = await signed_in.post(
        f"/api/sessions/{session_id}/tools", json={"tool": "explode", "params": {}}
    )
    invalid = await signed_in.post(
        f"/api/sessions/{session_id}/tools",
        json={"tool": "crop_canvas", "params": {}},
    )

    assert unknown.status_code == 404
    assert invalid.status_code == 422


async def test_remove_background_adopts_transparent_result(signed_in: httpx.AsyncClient):
    session = await open_session(signed_in)
    body = await invoke(signed_in, session["id"], "remove_background")
    run_id = uuid.UUID(body["run"]["id"])

    await run_tool({}, run_id)
    updated = (await signed_in.get(f"/api/sessions/{session['id']}")).json()
    current = next(
        asset for asset in updated["assets"] if asset["id"] == updated["current_asset_id"]
    )

    assert updated["revision"] == 2
    assert current["has_alpha"] is True
    assert current["id"] != session["current_asset_id"]


async def test_adjust_image_adopts_a_new_asset(signed_in: httpx.AsyncClient):
    session = await open_session(signed_in)
    body = await invoke(signed_in, session["id"], "adjust_image", {"brightness": 0.3})

    await run_tool({}, uuid.UUID(body["run"]["id"]))
    updated = (await signed_in.get(f"/api/sessions/{session['id']}")).json()

    assert updated["current_asset_id"] != session["current_asset_id"]
    assert updated["can_undo"] is True


async def test_agent_can_dispatch_a_canvas_tool(signed_in: httpx.AsyncClient, monkeypatch):
    fake = FakePlanner(
        AIMessage(
            content="",
            tool_calls=[{"name": "flip_layer", "args": {"direction": "horizontal"}, "id": "c1"}],
        )
    )
    monkeypatch.setattr(graph, "planner", lambda: fake)
    session_id = (await open_session(signed_in))["id"]

    turn = (
        await signed_in.post(f"/api/sessions/{session_id}/messages", json={"text": "水平翻转"})
    ).json()
    session = (await signed_in.get(f"/api/sessions/{session_id}")).json()

    assert turn["steps"][0]["tool"] == "flip_layer"
    assert session["document"]["layers"][0]["transform"]["scale_x"] == -1


async def test_session_tool_requires_authentication(client: httpx.AsyncClient):
    path = f"/api/sessions/{uuid.uuid4()}/tools"
    payload = {"tool": "flip_layer", "params": {"direction": "horizontal"}}
    assert (await client.post(path, json=payload)).status_code == 401
