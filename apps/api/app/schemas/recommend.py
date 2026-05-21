"""Schemas do endpoint de recomendação."""
from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Especie, Tecnica
from app.schemas.predict import FatorPredicao


class RecommendRequest(BaseModel):
    matriz_id: UUID = Field(..., description="UUID da matriz para recomendar reprodutores")
    tecnica: Tecnica = Field(default=Tecnica.IATF, description="Técnica de inseminação a ser usada")
    data_evento: date = Field(..., description="Data prevista para a inseminação")
    top_n: int = Field(default=5, ge=1, le=20, description="Quantidade de recomendações a retornar")
    filtrar_parentesco: bool = Field(default=True, description="Aplicar filtro heurístico de parentesco")


class AnimalResumo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    identificacao: str
    especie: Especie
    raca: str | None = None
    linhagem: str | None = None


class RecomendacaoItem(BaseModel):
    rank: int
    reprodutor: AnimalResumo
    probabilidade_prenhez: float
    classificacao: str
    fatores_positivos: list[FatorPredicao]
    fatores_negativos: list[FatorPredicao]


class RecommendResponse(BaseModel):
    matriz: AnimalResumo
    total_reprodutores_avaliados: int
    total_filtrados_por_parentesco: int
    modelo_versao: str
    auc_referencia: float
    recomendacoes: list[RecomendacaoItem]