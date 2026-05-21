"""Log de auditoria para conformidade com a LGPD."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDMixin


class AuditLog(Base, UUIDMixin):
    __tablename__ = "audit_log"

    usuario_id: Mapped[UUID | None] = mapped_column(index=True)
    acao: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    entidade: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    entidade_id: Mapped[UUID | None] = mapped_column(index=True)
    payload: Mapped[dict | None] = mapped_column(JSONB)
    ip: Mapped[str | None] = mapped_column(INET)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.acao} em {self.entidade} por {self.usuario_id}>"