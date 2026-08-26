import io

import httpx
import pytest
from PIL import Image

from app.services.images import ImageRejected, probe


def make_image(size=(256, 256), mode="RGB", fmt="PNG") -> bytes:
    buffer = io.BytesIO()
    Image.new(mode, size, "white").save(buffer, format=fmt)
    return buffer.getvalue()


@pytest.fixture
async def signed_in(client: httpx.AsyncClient, credentials):
    await client.post("/api/auth/register", json=credentials)
    return client


def upload_payload(data: bytes, name="a.png", content_type="image/png"):
    return {"file": (name, data, content_type)}


async def test_upload_returns_metadata_and_signed_url(signed_in: httpx.AsyncClient):
    response = await signed_in.post("/api/assets", files=upload_payload(make_image((320, 200))))

    assert response.status_code == 201
    body = response.json()
    assert (body["width"], body["height"]) == (320, 200)
    assert body["image_format"] == "PNG"
    assert body["kind"] == "original"
    assert "X-Amz-Signature" in body["url"]


async def test_upload_detects_alpha_channel(signed_in: httpx.AsyncClient):
    response = await signed_in.post(
        "/api/assets", files=upload_payload(make_image(mode="RGBA"))
    )

    assert response.json()["has_alpha"] is True


async def test_upload_rejects_corrupted_file(signed_in: httpx.AsyncClient):
    response = await signed_in.post("/api/assets", files=upload_payload(b"not-an-image"))

    assert response.status_code == 422


async def test_upload_rejects_unsupported_format(signed_in: httpx.AsyncClient):
    gif = make_image(fmt="GIF")

    response = await signed_in.post("/api/assets", files=upload_payload(gif, "a.gif", "image/gif"))

    assert response.status_code == 422


async def test_upload_ignores_spoofed_extension(signed_in: httpx.AsyncClient):
    """格式以解码结果为准：JPEG 内容伪装成 .png 仍应按 JPEG 记录。"""
    response = await signed_in.post(
        "/api/assets", files=upload_payload(make_image(fmt="JPEG"), "a.png", "image/png")
    )

    assert response.json()["image_format"] == "JPEG"


async def test_upload_requires_authentication(client: httpx.AsyncClient):
    response = await client.post("/api/assets", files=upload_payload(make_image()))

    assert response.status_code == 401


async def test_assets_are_isolated_per_user(client: httpx.AsyncClient, credentials):
    await client.post("/api/auth/register", json=credentials)
    created = await client.post("/api/assets", files=upload_payload(make_image()))
    asset_id = created.json()["id"]

    await client.post("/api/auth/logout")
    await client.post(
        "/api/auth/register", json={"username": "otheruser", "password": "secret123"}
    )

    assert (await client.get(f"/api/assets/{asset_id}")).status_code == 404
    assert (await client.get("/api/assets")).json() == []


def test_probe_rejects_tiny_image():
    with pytest.raises(ImageRejected):
        probe(make_image((16, 16)))
