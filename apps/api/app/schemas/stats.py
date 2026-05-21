"""Schemas do endpoint de estatísticas para o dashboard."""
from __future__ import annotations

from pydantic import BaseModel

from app.models.enums import Especie


class EstatisticaEspecie(BaseModel):
    especie: Especie
    total_animais: int
    total_matrizes: int
    total_reprodutores: int
    total_inseminacoes: int
    taxa_prenhez_pct: float
    inseminacoes_aguardando: int


class StatsResponse(BaseModel):
    total_animais: int
    total_inseminacoes: int
    taxa_prenhez_geral_pct: float
    por_especie: list[EstatisticaEspecie]