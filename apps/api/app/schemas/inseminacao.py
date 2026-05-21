"""Schemas Pydantic para o recurso Inseminação."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ResultadoDiagnostico, Tecnica


class InseminacaoCreate(BaseModel):
    matriz_id: UUID
    reprodutor_id: UUID | None = None
    semen_externo: dict[str, Any] | None = None
    data_evento: datetime
    tecnica: Tecnica
    inseminador: str | None = Field(default=None, max_length=160)
    observacoes: str | None = None
    # Predição opcional (vinda do front que chamou /predict antes)
    predicao_prenhez: float | None = Field(default=None, ge=0, le=1)
    predicao_features: dict[str, Any] | None = None
    modelo_versao: str | None = None


class InseminacaoUpdate(BaseModel):
    """Usado principalmente para atualizar o resultado do diagnóstico."""
    resultado_diagnostico: ResultadoDiagnostico | None = None
    data_diagnostico: date | None = None
    observacoes: str | None = None


class InseminacaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    matriz_id: UUID
    reprodutor_id: UUID | None
    semen_externo: dict[str, Any] | None
    data_evento: datetime
    tecnica: Tecnica
    inseminador: str | None
    observacoes: str | None
    resultado_diagnostico: ResultadoDiagnostico
    data_diagnostico: date | None
    predicao_prenhez: float | None
    modelo_versao: str | None
    created_at: datetime
    updated_at: datetime


class InseminacaoListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[InseminacaoOut]