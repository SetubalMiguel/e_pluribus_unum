"""Estatísticas agregadas para o dashboard."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_produtor
from app.db.session import get_db
from app.models import (
    Animal,
    Especie,
    Inseminacao,
    Produtor,
    ResultadoDiagnostico,
    Sexo,
)
from app.schemas.stats import EstatisticaEspecie, StatsResponse

router = APIRouter(prefix="/stats", tags=["Estatísticas"])


@router.get(
    "",
    response_model=StatsResponse,
    summary="Resumo agregado para o dashboard",
)
def estatisticas_dashboard(
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    # Totais gerais
    total_animais = db.execute(
        select(func.count(Animal.id)).where(
            Animal.produtor_id == produtor.id,
            Animal.ativo.is_(True),
        )
    ).scalar_one()

    total_inseminacoes_geral = db.execute(
        select(func.count(Inseminacao.id))
        .join(Animal, Animal.id == Inseminacao.matriz_id)
        .where(Animal.produtor_id == produtor.id)
    ).scalar_one()

    sucessos_geral = db.execute(
        select(func.count(Inseminacao.id))
        .join(Animal, Animal.id == Inseminacao.matriz_id)
        .where(
            Animal.produtor_id == produtor.id,
            Inseminacao.resultado_diagnostico == ResultadoDiagnostico.PRENHE,
        )
    ).scalar_one()

    taxa_geral = (
        round(100.0 * sucessos_geral / total_inseminacoes_geral, 1)
        if total_inseminacoes_geral > 0
        else 0.0
    )

    # Por espécie
    por_especie: list[EstatisticaEspecie] = []
    for especie in Especie:
        total_an = db.execute(
            select(func.count(Animal.id)).where(
                Animal.produtor_id == produtor.id,
                Animal.especie == especie,
                Animal.ativo.is_(True),
            )
        ).scalar_one()

        if total_an == 0:
            continue

        total_matrizes = db.execute(
            select(func.count(Animal.id)).where(
                Animal.produtor_id == produtor.id,
                Animal.especie == especie,
                Animal.sexo == Sexo.FEMEA,
                Animal.ativo.is_(True),
            )
        ).scalar_one()

        total_reprodutores = db.execute(
            select(func.count(Animal.id)).where(
                Animal.produtor_id == produtor.id,
                Animal.especie == especie,
                Animal.sexo == Sexo.MACHO,
                Animal.ativo.is_(True),
            )
        ).scalar_one()

        # Inseminações da espécie
        base_insem = (
            select(Inseminacao)
            .join(Animal, Animal.id == Inseminacao.matriz_id)
            .where(Animal.produtor_id == produtor.id, Animal.especie == especie)
        )

        total_insem = db.execute(
            select(func.count()).select_from(base_insem.subquery())
        ).scalar_one()

        sucessos = db.execute(
            select(func.count(Inseminacao.id))
            .join(Animal, Animal.id == Inseminacao.matriz_id)
            .where(
                Animal.produtor_id == produtor.id,
                Animal.especie == especie,
                Inseminacao.resultado_diagnostico == ResultadoDiagnostico.PRENHE,
            )
        ).scalar_one()

        aguardando = db.execute(
            select(func.count(Inseminacao.id))
            .join(Animal, Animal.id == Inseminacao.matriz_id)
            .where(
                Animal.produtor_id == produtor.id,
                Animal.especie == especie,
                Inseminacao.resultado_diagnostico == ResultadoDiagnostico.AGUARDANDO,
            )
        ).scalar_one()

        taxa = round(100.0 * sucessos / total_insem, 1) if total_insem > 0 else 0.0

        por_especie.append(EstatisticaEspecie(
            especie=especie,
            total_animais=total_an,
            total_matrizes=total_matrizes,
            total_reprodutores=total_reprodutores,
            total_inseminacoes=total_insem,
            taxa_prenhez_pct=taxa,
            inseminacoes_aguardando=aguardando,
        ))

    return StatsResponse(
        total_animais=total_animais,
        total_inseminacoes=total_inseminacoes_geral,
        taxa_prenhez_geral_pct=taxa_geral,
        por_especie=por_especie,
    )