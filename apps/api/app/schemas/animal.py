"""Schemas Pydantic para o recurso Animal."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import Especie, Sexo


# --------------------------- Dados genéticos -------------------------------

class DadosGeneticosFemea(BaseModel):
    """Dados genéticos/reprodutivos para fêmeas (matrizes)."""

    ecc: float = Field(
        ...,
        ge=1.0,
        le=5.0,
        description="Escore de Condição Corporal (1.0 a 5.0, ideal 3.0-3.5)",
    )
    paridade: int = Field(
        ...,
        ge=0,
        le=15,
        description="Número de partos prévios (0 = nulípara)",
    )
    idade_anos: float = Field(..., ge=0, le=25)
    historico_sucesso: float | None = Field(
        default=None,
        ge=0,
        le=1,
        description="Taxa histórica de sucesso reprodutivo (0-1). Calculada automaticamente se omitida.",
    )


class DadosGeneticosMacho(BaseModel):
    """Dados genéticos/reprodutivos para machos (reprodutores)."""

    idade_anos: float = Field(..., ge=0, le=20)
    taxa_sucesso_historica: float | None = Field(
        default=None,
        ge=0,
        le=1,
        description="Taxa histórica de prenhez gerada (0-1). Calculada automaticamente se omitida.",
    )


# --------------------------- Entrada (request) -----------------------------

class AnimalCreate(BaseModel):
    especie: Especie
    identificacao: str = Field(..., min_length=1, max_length=50)
    sexo: Sexo
    raca: str | None = Field(default=None, max_length=80)
    linhagem: str | None = Field(default=None, max_length=120)
    origem: str | None = Field(default=None, max_length=120)
    data_nascimento: date | None = None
    dados_geneticos: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validar_dados_geneticos_por_sexo(self):
        """Valida que os dados genéticos batem com o sexo do animal."""
        if self.sexo == Sexo.FEMEA:
            # Valida campos de fêmea (não obrigatório, mas se vier deve ser válido)
            if self.dados_geneticos:
                DadosGeneticosFemea.model_validate(self.dados_geneticos)
        elif self.sexo == Sexo.MACHO:
            if self.dados_geneticos:
                DadosGeneticosMacho.model_validate(self.dados_geneticos)
        return self


class AnimalUpdate(BaseModel):
    """Todos os campos opcionais para PATCH."""
    raca: str | None = Field(default=None, max_length=80)
    linhagem: str | None = Field(default=None, max_length=120)
    origem: str | None = Field(default=None, max_length=120)
    data_nascimento: date | None = None
    dados_geneticos: dict[str, Any] | None = None
    ativo: bool | None = None


# --------------------------- Saída (response) ------------------------------

class AnimalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    especie: Especie
    identificacao: str
    sexo: Sexo
    raca: str | None
    linhagem: str | None
    origem: str | None
    data_nascimento: date | None
    dados_geneticos: dict[str, Any]
    ativo: bool
    created_at: datetime
    updated_at: datetime


class AnimalListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[AnimalOut]