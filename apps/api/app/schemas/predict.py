"""Schemas de entrada e saída do endpoint de predição."""
from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import Tecnica


class PredictRequest(BaseModel):
    """Predição usando IDs do banco — busca os dados internamente."""

    matriz_id: UUID = Field(..., description="UUID do animal fêmea")
    reprodutor_id: UUID = Field(..., description="UUID do animal macho")
    tecnica: Tecnica
    data_evento: date


class FatorPredicao(BaseModel):
    feature: str
    valor: float
    impacto_relativo: float


class PredictResponse(BaseModel):
    probabilidade_prenhez: float = Field(..., ge=0, le=1)
    classificacao: str = Field(..., description="alta, media ou baixa")
    fatores_positivos: list[FatorPredicao]
    fatores_negativos: list[FatorPredicao]
    modelo_versao: str
    auc_referencia: float = Field(..., description="AUC ROC de validação cruzada do modelo")