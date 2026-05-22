"""CRUD de Ciclos Reprodutivos."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.auth import get_current_produtor
from app.db.session import get_db
from app.models import (
    Animal,
    CicloReprodutivo,
    Especie,
    Produtor,
    Sexo,
    StatusCiclo,
)
from app.schemas.ciclo import (
    CicloCreate,
    CicloListResponse,
    CicloOut,
    CicloUpdate,
)

router = APIRouter(prefix="/cycles", tags=["Ciclos Reprodutivos"])


def _animal_do_produtor(db: Session, animal_id: UUID, produtor: Produtor) -> Animal:
    animal = db.get(Animal, animal_id)
    if animal is None or animal.produtor_id != produtor.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Animal {animal_id} não encontrado")
    return animal


def _carrega_ciclo(db: Session, ciclo_id: UUID) -> CicloReprodutivo:
    stmt = (
        select(CicloReprodutivo)
        .options(
            selectinload(CicloReprodutivo.matriz),
            selectinload(CicloReprodutivo.cria),
        )
        .where(CicloReprodutivo.id == ciclo_id)
    )
    ciclo = db.execute(stmt).scalar_one_or_none()
    if ciclo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ciclo não encontrado")
    return ciclo


@router.get(
    "",
    response_model=CicloListResponse,
    summary="Lista ciclos reprodutivos com filtros",
)
def listar_ciclos(
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
    matriz_id: UUID | None = Query(default=None),
    especie: Especie | None = Query(default=None),
    status_ciclo: StatusCiclo | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
):
    base = (
        select(CicloReprodutivo)
        .join(Animal, Animal.id == CicloReprodutivo.matriz_id)
        .where(Animal.produtor_id == produtor.id)
    )

    filtros = []
    if matriz_id is not None:
        filtros.append(CicloReprodutivo.matriz_id == matriz_id)
    if especie is not None:
        filtros.append(Animal.especie == especie)
    if status_ciclo is not None:
        filtros.append(CicloReprodutivo.status == status_ciclo)
    if filtros:
        base = base.where(and_(*filtros))

    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()

    offset = (page - 1) * page_size
    stmt = (
        base.options(
            selectinload(CicloReprodutivo.matriz),
            selectinload(CicloReprodutivo.cria),
        )
        .order_by(CicloReprodutivo.data_inicio.desc(), CicloReprodutivo.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    items = list(db.execute(stmt).scalars().all())

    return CicloListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[CicloOut.model_validate(c) for c in items],
    )


@router.get(
    "/{ciclo_id}",
    response_model=CicloOut,
    summary="Detalhes de um ciclo",
)
def obter_ciclo(
    ciclo_id: UUID,
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    ciclo = _carrega_ciclo(db, ciclo_id)
    _animal_do_produtor(db, ciclo.matriz_id, produtor)
    return CicloOut.model_validate(ciclo)


@router.post(
    "",
    response_model=CicloOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cria um novo ciclo reprodutivo",
)
def criar_ciclo(
    payload: CicloCreate,
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    matriz = _animal_do_produtor(db, payload.matriz_id, produtor)
    if matriz.sexo != Sexo.FEMEA:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Matriz deve ser fêmea")

    if payload.cria_id is not None:
        cria = _animal_do_produtor(db, payload.cria_id, produtor)
        if cria.especie != matriz.especie:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Cria deve ser da mesma espécie da matriz",
            )

    ciclo = CicloReprodutivo(
        matriz_id=payload.matriz_id,
        data_inicio=payload.data_inicio,
        data_fim=payload.data_fim,
        status=payload.status,
        parto_data=payload.parto_data,
        cria_id=payload.cria_id,
    )
    db.add(ciclo)
    db.commit()
    return CicloOut.model_validate(_carrega_ciclo(db, ciclo.id))


@router.patch(
    "/{ciclo_id}",
    response_model=CicloOut,
    summary="Atualiza um ciclo (fechar com parto/falha, registrar cria)",
)
def atualizar_ciclo(
    ciclo_id: UUID,
    payload: CicloUpdate,
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    ciclo = _carrega_ciclo(db, ciclo_id)
    _animal_do_produtor(db, ciclo.matriz_id, produtor)

    update_data = payload.model_dump(exclude_unset=True)

    # Valida cria_id contra a matriz (mesmo produtor + mesma espécie).
    if "cria_id" in update_data and update_data["cria_id"] is not None:
        cria = _animal_do_produtor(db, update_data["cria_id"], produtor)
        if cria.especie != ciclo.matriz.especie:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Cria deve ser da mesma espécie da matriz",
            )

    for campo, valor in update_data.items():
        setattr(ciclo, campo, valor)

    # Coerência mínima: data_fim >= data_inicio quando informada.
    if ciclo.data_fim and ciclo.data_fim < ciclo.data_inicio:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "data_fim não pode ser anterior a data_inicio",
        )
    if ciclo.parto_data and ciclo.parto_data < ciclo.data_inicio:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "parto_data não pode ser anterior a data_inicio",
        )

    db.commit()
    return CicloOut.model_validate(_carrega_ciclo(db, ciclo.id))


@router.delete(
    "/{ciclo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove um ciclo",
)
def remover_ciclo(
    ciclo_id: UUID,
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    ciclo = _carrega_ciclo(db, ciclo_id)
    _animal_do_produtor(db, ciclo.matriz_id, produtor)
    db.delete(ciclo)
    db.commit()
    return None
