"""Recomendação de cruzamento gerada pela IA."""
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.animal import Animal


class RecomendacaoCruzamento(Base, UUIDMixin):
    __tablename__ = "recomendacao_cruzamento"

    matriz_id: Mapped[UUID] = mapped_column(ForeignKey("animal.id", ondelete="CASCADE"), nullable=False, index=True)
    reprodutor_id: Mapped[UUID] = mapped_column(ForeignKey("animal.id", ondelete="CASCADE"), nullable=False, index=True)

    score: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)

    # Features SHAP que justificam o score (chave: nome da feature, valor: contribuição).
    justificativa: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    modelo_versao: Mapped[str] = mapped_column(String(20), nullable=False)
    gerada_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    matriz: Mapped["Animal"] = relationship(foreign_keys=[matriz_id])
    reprodutor: Mapped["Animal"] = relationship(foreign_keys=[reprodutor_id])

    def __repr__(self) -> str:
        return f"<RecomendacaoCruzamento matriz={self.matriz_id} reprodutor={self.reprodutor_id} score={self.score}>"