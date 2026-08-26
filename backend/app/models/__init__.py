"""模型包。新增模型后需在此导出，供 Alembic autogenerate 发现。"""

from app.models.asset import Asset
from app.models.user import User

__all__ = ["Asset", "User"]
