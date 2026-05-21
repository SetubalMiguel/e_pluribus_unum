"""Schemas Pydantic para o recurso Animal."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Especie, Sexo


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