import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from app.models import AgentRun
from app.models.tool_run import RunStatus
from app.tools import label_of

MAX_MESSAGE = 1000


class MessageIn(BaseModel):
    text: Annotated[str, Field(min_length=1, max_length=MAX_MESSAGE)]

    @field_validator("text")
    @classmethod
    def _require_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("指令不能为空")
        return value


class PlanStepOut(BaseModel):
    tool: str
    label: str
    run_id: uuid.UUID | None = None

    @classmethod
    def of(cls, step: dict) -> "PlanStepOut":
        return cls(tool=step["tool"], label=label_of(step["tool"]), run_id=step.get("run_id"))


class TurnOut(BaseModel):
    id: uuid.UUID
    revision: int
    goal: str
    reply: str
    status: RunStatus
    error: str | None
    created_at: datetime
    steps: list[PlanStepOut] = []

    @classmethod
    def of(cls, turn: AgentRun) -> "TurnOut":
        return cls(
            id=turn.id,
            revision=turn.revision,
            goal=turn.goal,
            reply=turn.reply,
            status=turn.status,
            error=turn.error,
            created_at=turn.created_at,
            steps=[PlanStepOut.of(step) for step in turn.plan],
        )
