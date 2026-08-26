import logging
import uuid

from app.db import SessionFactory
from app.models.tool_run import RunStatus
from app.services import generation, runs

logger = logging.getLogger(__name__)


async def generate_images(ctx: dict, run_id: uuid.UUID) -> None:
    async with SessionFactory() as session:
        try:
            run = await runs.load(session, run_id)
        except runs.RunNotFound:
            return
        # 队列重投或 worker 重启后的重复消费不应二次扣费
        if run.status.is_terminal:
            return

        try:
            await generation.execute(session, run)
        except Exception:
            # 任何遗漏的异常都必须落终态，否则订阅进度的客户端会一直空等
            logger.exception("生成任务未捕获异常 run_id=%s", run_id)
            await session.rollback()
            await runs.finish(session, run, status=RunStatus.FAILED, error="生成失败，请重试")
