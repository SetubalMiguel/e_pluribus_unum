"""CRUD de Inseminações."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
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
from app.schemas.inseminacao import (
    InseminacaoCreate,
    InseminacaoListResponse,
    InseminacaoOut,
    InseminacaoUpdate,
)

router = APIRouter(prefix="/inseminations", tags=["Inseminações"])


def _verificar_animal_do_produtor(
    db: Session, animal_id: UUID, produtor: Produtor
) -> Animal:
    animal = db.get(Animal, animal_id)
    if animal is None or animal.produtor_id != produtor.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Animal {animal_id} não encontrado")
    return animal


@router.get(
    "",
    response_model=InseminacaoListResponse,
    summary="Lista inseminações com filtros",
)
def listar_inseminacoes(
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
    matriz_id: UUID | None = Query(default=None),
    especie: Especie | None = Query(default=None),
    resultado: ResultadoDiagnostico | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    # Join com Animal (matriz) para filtrar por produtor e espécie
    base = (
        select(Inseminacao)
        .join(Animal, Animal.id == Inseminacao.matriz_id)
        .where(Animal.produtor_id == produtor.id)
    )

    filtros = []
    if matriz_id is not None:
        filtros.append(Inseminacao.matriz_id == matriz_id)
    if especie is not None:
        filtros.append(Animal.especie == especie)
    if resultado is not None:
        filtros.append(Inseminacao.resultado_diagnostico == resultado)

    if filtros:
        base = base.where(and_(*filtros))

    total = db.execute(
        select(func.count()).select_from(base.subquery())
    ).scalar_one()

    offset = (page - 1) * page_size
    stmt = base.order_by(Inseminacao.data_evento.desc()).offset(offset).limit(page_size)
    items = list(db.execute(stmt).scalars().all())

    return InseminacaoListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[InseminacaoOut.model_validate(i) for i in items],
    )


@router.get(
    "/{inseminacao_id}",
    response_model=InseminacaoOut,
    summary="Detalhes de uma inseminação",
)
def obter_inseminacao(
    inseminacao_id: UUID,
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    insem = db.get(Inseminacao, inseminacao_id)
    if insem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inseminação não encontrada")
    # Verifica que a matriz pertence ao produtor
    _verificar_animal_do_produtor(db, insem.matriz_id, produtor)
    return InseminacaoOut.model_validate(insem)


@router.post(
    "",
    response_model=InseminacaoOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registra uma nova inseminação",
)
def criar_inseminacao(
    payload: InseminacaoCreate,
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    matriz = _verificar_animal_do_produtor(db, payload.matriz_id, produtor)
    if matriz.sexo != Sexo.FEMEA:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Matriz deve ser fêmea")

    if payload.reprodutor_id is not None:
        reprodutor = _verificar_animal_do_produtor(db, payload.reprodutor_id, produtor)
        if reprodutor.sexo != Sexo.MACHO:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reprodutor deve ser macho")
        if reprodutor.especie != matriz.especie:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Matriz e reprodutor devem ser da mesma espécie",
            )
    elif payload.semen_externo is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Informe reprodutor_id OU dados de semen_externo",
        )

    insem = Inseminacao(
        matriz_id=payload.matriz_id,
        reprodutor_id=payload.reprodutor_id,
        semen_externo=payload.semen_externo,
        data_evento=payload.data_evento,
        tecnica=payload.tecnica,
        inseminador=payload.inseminador,
        observacoes=payload.observacoes,
        resultado_diagnostico=ResultadoDiagnostico.AGUARDANDO,
        predicao_prenhez=payload.predicao_prenhez,
        predicao_features=payload.predicao_features,
        modelo_versao=payload.modelo_versao,
    )
    db.add(insem)
    db.commit()
    db.refresh(insem)
    return InseminacaoOut.model_validate(insem)


@router.patch(
    "/{inseminacao_id}",
    response_model=InseminacaoOut,
    summary="Atualiza resultado de diagnóstico de prenhez",
)
def atualizar_inseminacao(
    inseminacao_id: UUID,
    payload: InseminacaoUpdate,
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    insem = db.get(Inseminacao, inseminacao_id)
    if insem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inseminação não encontrada")
    _verificar_animal_do_produtor(db, insem.matriz_id, produtor)

    update_data = payload.model_dump(exclude_unset=True)
    for campo, valor in update_data.items():
        setattr(insem, campo, valor)

    db.commit()
    db.refresh(insem)
    return InseminacaoOut.model_validate(insem)


@router.delete(
    "/{inseminacao_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove uma inseminação (hard delete)",
)
def remover_inseminacao(
    inseminacao_id: UUID,
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    insem = db.get(Inseminacao, inseminacao_id)
    if insem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inseminação não encontrada")
    _verificar_animal_do_produtor(db, insem.matriz_id, produtor)

    db.delete(insem)
    db.commit()
    return None