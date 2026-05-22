"""Schemas Pydantic para Ciclo Reprodutivo."""
from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import Especie, StatusCiclo


class CicloAnimalBrief(BaseModel):
    """Resumo do animal embutido nas respostas de ciclo."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    identificacao: str
    especie: Especie


class CicloCreate(BaseModel):
    matriz_id: UUID
    data_inicio: date
    data_fim: date | None = None
    status: StatusCiclo = StatusCiclo.ATIVO
    parto_data: date | None = None
    cria_id: UUID | None = None

    @model_validator(mode="after")
    def _coerencia_datas(self) -> "CicloCreate":
        if self.data_fim and self.data_fim < self.data_inicio:
            raise ValueError("data_fim não pode ser anterior a data_inicio")
        if self.parto_data and self.parto_data < self.data_inicio:
            raise ValueError("parto_data não pode ser anterior a data_inicio")
        # Se já vem com parto/cria mas status ainda ativo, normaliza.
        if self.status == StatusCiclo.ATIVO and (self.parto_data or self.cria_id):
            raise ValueError(
                "Ciclo com parto/cria registrados deve ter status concluido_sucesso ou concluido_falha"
            )
        return self


class CicloUpdate(BaseModel):
    """Atualização parcial. Use para fechar o ciclo (parto/falha) ou ajustar datas."""

    data_fim: date | None = None
    status: StatusCiclo | None = None
    parto_data: date | None = None
    cria_id: UUID | None = None


class CicloOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    matriz: CicloAnimalBrief
    data_inicio: date
    data_fim: date | None
    status: StatusCiclo
    parto_data: date | None
    cria: CicloAnimalBrief | None
    created_at: datetime
    updated_at: datetime


class CicloListResponse(BaseModel):
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    items: list[CicloOut]
