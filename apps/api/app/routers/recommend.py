"""Router de recomendação de cruzamentos."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Animal, Sexo
from app.schemas.recommend import (
    AnimalResumo,
    RecommendRequest,
    RecommendResponse,
    RecomendacaoItem,
)
from app.services.recommender import recomendar_cruzamentos, _eh_aparentado

router = APIRouter(prefix="/recommend", tags=["IA"])


@router.post(
    "",
    response_model=RecommendResponse,
    summary="Recomenda os melhores reprodutores para uma matriz, ranqueados pela IA",
)
def recomendar(
    payload: RecommendRequest,
    db: Session = Depends(get_db),
) -> RecommendResponse:
    matriz = db.get(Animal, payload.matriz_id)
    if matriz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Matriz não encontrada")
    if matriz.sexo != Sexo.FEMEA:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Matriz deve ser fêmea")
    if not matriz.ativo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Matriz está inativa")

    # Conta totais para meta-informação
    stmt_total = select(Animal).where(
        Animal.especie == matriz.especie,
        Animal.sexo == Sexo.MACHO,
        Animal.ativo.is_(True),
    )
    todos_reprodutores = list(db.execute(stmt_total).scalars().all())
    total_avaliados = len(todos_reprodutores)

    if payload.filtrar_parentesco:
        total_filtrados = sum(1 for r in todos_reprodutores if _eh_aparentado(matriz, r))
    else:
        total_filtrados = 0

    candidatos = recomendar_cruzamentos(
        db=db,
        matriz=matriz,
        tecnica=payload.tecnica.value,
        data_evento=payload.data_evento,
        top_n=payload.top_n,
        filtrar_parentesco=payload.filtrar_parentesco,
    )

    if not candidatos:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Nenhum reprodutor compatível encontrado para a espécie {matriz.especie.value}",
        )

    primeira_predicao = candidatos[0]["predicao"]

    recomendacoes = [
        RecomendacaoItem(
            rank=i + 1,
            reprodutor=AnimalResumo.model_validate(c["reprodutor"]),
            probabilidade_prenhez=c["predicao"]["probabilidade_prenhez"],
            classificacao=c["predicao"]["classificacao"],
            fatores_positivos=c["predicao"]["fatores_positivos"],
            fatores_negativos=c["predicao"]["fatores_negativos"],
        )
        for i, c in enumerate(candidatos)
    ]

    return RecommendResponse(
        matriz=AnimalResumo.model_validate(matriz),
        total_reprodutores_avaliados=total_avaliados,
        total_filtrados_por_parentesco=total_filtrados,
        modelo_versao=primeira_predicao["modelo_versao"],
        auc_referencia=primeira_predicao["auc_referencia"],
        recomendacoes=recomendacoes,
    )