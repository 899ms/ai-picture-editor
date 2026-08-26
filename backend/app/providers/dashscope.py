import asyncio
import base64

import httpx

from app.config import get_settings
from app.providers.base import (
    GenerateRequest,
    ImageProvider,
    ProgressCallback,
    ProviderError,
)

_SUBMIT_PATH = "/api/v1/services/aigc/image-generation/generation"
_TASK_PATH = "/api/v1/tasks/{task_id}"

_POLL_INTERVAL = 3.0
_POLL_TIMEOUT = 300.0
_TERMINAL = {"SUCCEEDED", "FAILED", "CANCELED", "UNKNOWN"}

_PROGRESS = {"PENDING": (10, "排队中"), "RUNNING": (45, "生成中")}


class DashScopeImageProvider(ImageProvider):
    """百炼千问图像模型。

    使用异步接口：提交任务取回 task_id 后轮询。部分账号不开放同步调用，
    异步路径同时能提供真实的排队与执行状态。
    """

    name = "dashscope"

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.dashscope_api_key:
            raise ProviderError("未配置 DASHSCOPE_API_KEY")
        self._model = settings.text_to_image_model
        self._client = httpx.AsyncClient(
            base_url=settings.dashscope_base_url,
            headers={"Authorization": f"Bearer {settings.dashscope_api_key}"},
            timeout=30.0,
        )

    async def generate(
        self, request: GenerateRequest, on_progress: ProgressCallback | None = None
    ) -> list[bytes]:
        task_id = await self._submit(request)
        urls = await self._await_result(task_id, on_progress)
        return await asyncio.gather(*(self._download(url) for url in urls))

    def _payload(self, request: GenerateRequest) -> dict:
        # 本地对象存储无法被模型服务访问，参考图一律以 base64 内联
        content: list[dict] = [
            {"image": f"data:image/png;base64,{base64.b64encode(raw).decode()}"}
            for raw in request.references
        ]
        content.append({"text": request.prompt})

        parameters: dict = {
            "n": request.count,
            "size": f"{request.width}*{request.height}",
            "watermark": False,
        }
        if request.negative_prompt:
            parameters["negative_prompt"] = request.negative_prompt
        if request.seed is not None:
            parameters["seed"] = request.seed

        return {
            "model": self._model,
            "input": {"messages": [{"role": "user", "content": content}]},
            "parameters": parameters,
        }

    async def _submit(self, request: GenerateRequest) -> str:
        response = await self._client.post(
            _SUBMIT_PATH,
            json=self._payload(request),
            headers={"X-DashScope-Async": "enable"},
        )
        body = self._parse(response)
        task_id = body.get("output", {}).get("task_id")
        if not task_id:
            raise ProviderError("模型服务未返回任务 ID")
        return task_id

    async def _await_result(self, task_id: str, on_progress: ProgressCallback | None) -> list[str]:
        deadline = asyncio.get_running_loop().time() + _POLL_TIMEOUT

        while True:
            response = await self._client.get(_TASK_PATH.format(task_id=task_id))
            output = self._parse(response).get("output", {})
            status = output.get("task_status", "UNKNOWN")

            if status in _TERMINAL:
                if status != "SUCCEEDED":
                    raise ProviderError(f"生成任务{status}：{output.get('message', '未知原因')}")
                return _extract_urls(output)

            if on_progress and status in _PROGRESS:
                await on_progress(*_PROGRESS[status])

            if asyncio.get_running_loop().time() > deadline:
                raise ProviderError("生成任务超时")
            await asyncio.sleep(_POLL_INTERVAL)

    async def _download(self, url: str) -> bytes:
        """结果 URL 有效期 24 小时，须立即取回并转存到自有存储。"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(url)
        if response.status_code != httpx.codes.OK:
            raise ProviderError("生成结果下载失败")
        return response.content

    @staticmethod
    def _parse(response: httpx.Response) -> dict:
        try:
            body = response.json()
        except ValueError as exc:
            raise ProviderError(f"模型服务返回非 JSON 响应（HTTP {response.status_code}）") from exc

        if response.status_code != httpx.codes.OK or "code" in body:
            raise ProviderError(body.get("message") or f"模型服务错误 HTTP {response.status_code}")
        return body


def _extract_urls(output: dict) -> list[str]:
    urls = [
        item["image"]
        for choice in output.get("choices", [])
        for item in choice.get("message", {}).get("content", [])
        if "image" in item
    ]
    if not urls:
        raise ProviderError("生成任务成功但未返回图片")
    return urls
