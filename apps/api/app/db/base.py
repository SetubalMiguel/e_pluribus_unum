"""Base declarativa do SQLAlchemy. Centraliza imports dos models para o Alembic."""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Classe base para todos os models."""

    pass


class TimestampMixin:
    """Adiciona created_at e updated_at automaticamente."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class UUIDMixin:
    """Adiciona uma PK do tipo UUID com default gerado pela app."""

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
        nullable=False,
    )


# Imports dos models para que o Alembic os descubra via Base.metadata.
# Esses imports são intencionais e ficam aqui no final do arquivo.
from app.models.audit_log import AuditLog  # noqa: E402, F401
from app.models.animal import Animal  # noqa: E402, F401
from app.models.ciclo_reprodutivo import CicloReprodutivo  # noqa: E402, F401
from app.models.inseminacao import Inseminacao  # noqa: E402, F401
from app.models.produtor import Produtor  # noqa: E402, F401
from app.models.recomendacao_cruzamento import RecomendacaoCruzamento  # noqa: E402, F401