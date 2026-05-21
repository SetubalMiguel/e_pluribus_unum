"""Produtor rural — dono do rebanho."""
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.animal import Animal


class Produtor(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "produtor"

    nome: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    telefone: Mapped[str | None] = mapped_column(String(20))
    cpf: Mapped[str | None] = mapped_column(String(14), unique=True, index=True)
    propriedade: Mapped[str | None] = mapped_column(String(160))
    municipio: Mapped[str | None] = mapped_column(String(120))
    uf: Mapped[str | None] = mapped_column(String(2))

    animais: Mapped[list["Animal"]] = relationship(back_populates="produtor", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Produtor {self.nome} ({self.email})>"