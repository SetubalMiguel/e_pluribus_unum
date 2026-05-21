"""Ciclo reprodutivo — agrupa eventos da matriz do cio até o parto (ou falha)."""
from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, ForeignKey
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import StatusCiclo

if TYPE_CHECKING:
    from app.models.animal import Animal


class CicloReprodutivo(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ciclo_reprodutivo"

    matriz_id: Mapped[UUID] = mapped_column(ForeignKey("animal.id", ondelete="CASCADE"), nullable=False, index=True)
    data_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    data_fim: Mapped[date | None] = mapped_column(Date)

    status: Mapped[StatusCiclo] = mapped_column(
        ENUM(StatusCiclo, name="status_ciclo_enum", create_type=True),
        nullable=False,
        default=StatusCiclo.ATIVO,
    )

    parto_data: Mapped[date | None] = mapped_column(Date)
    cria_id: Mapped[UUID | None] = mapped_column(ForeignKey("animal.id", ondelete="SET NULL"))

    matriz: Mapped["Animal"] = relationship(back_populates="ciclos", foreign_keys=[matriz_id])
    cria: Mapped["Animal | None"] = relationship(foreign_keys=[cria_id])

    def __repr__(self) -> str:
        return f"<CicloReprodutivo {self.id} matriz={self.matriz_id} status={self.status.value}>"