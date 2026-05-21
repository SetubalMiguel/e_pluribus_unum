"""Evento de inseminação artificial."""
from datetime import date, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import ResultadoDiagnostico, Tecnica

if TYPE_CHECKING:
    from app.models.animal import Animal


class Inseminacao(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "inseminacao"

    matriz_id: Mapped[UUID] = mapped_column(ForeignKey("animal.id", ondelete="CASCADE"), nullable=False, index=True)
    reprodutor_id: Mapped[UUID | None] = mapped_column(ForeignKey("animal.id", ondelete="SET NULL"), index=True)

    # Sêmen externo (importado, sem cadastro local): origem, registro, raça, central.
    semen_externo: Mapped[dict | None] = mapped_column(JSONB)

    data_evento: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    tecnica: Mapped[Tecnica] = mapped_column(
        ENUM(Tecnica, name="tecnica_enum", create_type=True),
        nullable=False,
    )
    inseminador: Mapped[str | None] = mapped_column(String(160))
    observacoes: Mapped[str | None] = mapped_column(Text)

    resultado_diagnostico: Mapped[ResultadoDiagnostico] = mapped_column(
        ENUM(ResultadoDiagnostico, name="resultado_diagnostico_enum", create_type=True),
        nullable=False,
        default=ResultadoDiagnostico.AGUARDANDO,
    )
    data_diagnostico: Mapped[date | None] = mapped_column(Date)

    # Predição da IA salva no momento da inseminação, para auditoria.
    predicao_prenhez: Mapped[float | None] = mapped_column(Numeric(4, 3))
    predicao_features: Mapped[dict | None] = mapped_column(JSONB)
    modelo_versao: Mapped[str | None] = mapped_column(String(20))

    matriz: Mapped["Animal"] = relationship(
        back_populates="inseminacoes_como_matriz",
        foreign_keys=[matriz_id],
    )
    reprodutor: Mapped["Animal | None"] = relationship(foreign_keys=[reprodutor_id])

    def __repr__(self) -> str:
        return f"<Inseminacao {self.id} matriz={self.matriz_id} em {self.data_evento}>"