"""Animal — registro genético e reprodutivo, comum às 3 espécies."""
from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import Especie, Sexo

if TYPE_CHECKING:
    from app.models.ciclo_reprodutivo import CicloReprodutivo
    from app.models.inseminacao import Inseminacao
    from app.models.produtor import Produtor


class Animal(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "animal"
    __table_args__ = (
        UniqueConstraint("produtor_id", "identificacao", name="uq_animal_produtor_identificacao"),
    )

    produtor_id: Mapped[UUID] = mapped_column(ForeignKey("produtor.id", ondelete="CASCADE"), nullable=False, index=True)
    especie: Mapped[Especie] = mapped_column(
        ENUM(Especie, name="especie_enum", create_type=True),
        nullable=False,
        index=True,
    )
    identificacao: Mapped[str] = mapped_column(String(50), nullable=False)
    sexo: Mapped[Sexo] = mapped_column(
        ENUM(Sexo, name="sexo_enum", create_type=True),
        nullable=False,
    )
    data_nascimento: Mapped[date | None] = mapped_column(Date)
    raca: Mapped[str | None] = mapped_column(String(80))
    linhagem: Mapped[str | None] = mapped_column(String(120))
    origem: Mapped[str | None] = mapped_column(String(120))

    # Campos genéticos flexíveis por espécie (ECC, EPD, produção leiteira, etc).
    dados_geneticos: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    produtor: Mapped["Produtor"] = relationship(back_populates="animais")
    ciclos: Mapped[list["CicloReprodutivo"]] = relationship(
        back_populates="matriz",
        foreign_keys="CicloReprodutivo.matriz_id",
        cascade="all, delete-orphan",
    )
    inseminacoes_como_matriz: Mapped[list["Inseminacao"]] = relationship(
        back_populates="matriz",
        foreign_keys="Inseminacao.matriz_id",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Animal {self.identificacao} ({self.especie.value})>"