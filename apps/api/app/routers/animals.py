"""CRUD de Animais."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_produtor
from app.db.session import get_db
from app.models import Animal, Especie, Produtor, Sexo
from app.schemas.animal import (
    AnimalCreate,
    AnimalListResponse,
    AnimalOut,
    AnimalUpdate,
)

router = APIRouter(prefix="/animals", tags=["Animais"])


@router.get(
    "",
    response_model=AnimalListResponse,
    summary="Lista animais do produtor com filtros e paginação",
)
def listar_animais(
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
    especie: Especie | None = Query(default=None),
    sexo: Sexo | None = Query(default=None),
    ativo: bool = Query(default=True),
    busca: str | None = Query(default=None, description="Busca por identificação (LIKE)"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    filtros = [Animal.produtor_id == produtor.id, Animal.ativo == ativo]
    if especie is not None:
        filtros.append(Animal.especie == especie)
    if sexo is not None:
        filtros.append(Animal.sexo == sexo)
    if busca:
        filtros.append(Animal.identificacao.ilike(f"%{busca}%"))

    base = select(Animal).where(and_(*filtros))

    total = db.execute(
        select(func.count()).select_from(base.subquery())
    ).scalar_one()

    offset = (page - 1) * page_size
    stmt = base.order_by(Animal.identificacao).offset(offset).limit(page_size)
    items = list(db.execute(stmt).scalars().all())

    return AnimalListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[AnimalOut.model_validate(a) for a in items],
    )


@router.get(
    "/{animal_id}",
    response_model=AnimalOut,
    summary="Detalhes de um animal específico",
)
def obter_animal(
    animal_id: UUID,
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    animal = db.get(Animal, animal_id)
    if animal is None or animal.produtor_id != produtor.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal não encontrado")
    return AnimalOut.model_validate(animal)


@router.post(
    "",
    response_model=AnimalOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastra um novo animal",
)
def criar_animal(
    payload: AnimalCreate,
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    # Verifica duplicidade de identificação
    existente = db.execute(
        select(Animal).where(
            Animal.produtor_id == produtor.id,
            Animal.identificacao == payload.identificacao,
        )
    ).scalar_one_or_none()

    if existente is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Já existe um animal com identificação '{payload.identificacao}'",
        )

    animal = Animal(
        produtor_id=produtor.id,
        especie=payload.especie,
        identificacao=payload.identificacao,
        sexo=payload.sexo,
        raca=payload.raca,
        linhagem=payload.linhagem,
        origem=payload.origem,
        data_nascimento=payload.data_nascimento,
        dados_geneticos=payload.dados_geneticos or {},
    )
    db.add(animal)
    db.commit()
    db.refresh(animal)
    return AnimalOut.model_validate(animal)


@router.patch(
    "/{animal_id}",
    response_model=AnimalOut,
    summary="Atualiza dados de um animal",
)
def atualizar_animal(
    animal_id: UUID,
    payload: AnimalUpdate,
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    animal = db.get(Animal, animal_id)
    if animal is None or animal.produtor_id != produtor.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal não encontrado")

    update_data = payload.model_dump(exclude_unset=True)
    for campo, valor in update_data.items():
        setattr(animal, campo, valor)

    db.commit()
    db.refresh(animal)
    return AnimalOut.model_validate(animal)

@router.patch(
    "/{animal_id}/dados-geneticos",
    response_model=AnimalOut,
    summary="Atualiza apenas os dados genéticos do animal (tipado por sexo)",
)
def atualizar_dados_geneticos(
    animal_id: UUID,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    """
    Endpoint dedicado para atualizar ECC, paridade, idade etc.
    
    Para fêmea: aceita campos ecc, paridade, idade_anos, historico_sucesso.
    Para macho: aceita campos idade_anos, taxa_sucesso_historica.
    """
    from app.schemas.animal import DadosGeneticosFemea, DadosGeneticosMacho

    animal = db.get(Animal, animal_id)
    if animal is None or animal.produtor_id != produtor.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal não encontrado")

    # Mescla com o que já existe (atualização parcial)
    dados_atuais = animal.dados_geneticos or {}
    dados_novos = {**dados_atuais, **payload}

    # Valida conforme o sexo
    if animal.sexo == Sexo.FEMEA:
        try:
            DadosGeneticosFemea.model_validate(dados_novos)
        except Exception as exc:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Dados genéticos inválidos para fêmea: {exc}",
            )
    else:
        try:
            DadosGeneticosMacho.model_validate(dados_novos)
        except Exception as exc:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Dados genéticos inválidos para macho: {exc}",
            )

    animal.dados_geneticos = dados_novos
    db.commit()
    db.refresh(animal)
    return AnimalOut.model_validate(animal)


@router.delete(
    "/{animal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft delete: marca o animal como inativo (preserva histórico)",
)
def remover_animal(
    animal_id: UUID,
    db: Session = Depends(get_db),
    produtor: Produtor = Depends(get_current_produtor),
):
    animal = db.get(Animal, animal_id)
    if animal is None or animal.produtor_id != produtor.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Animal não encontrado")

    animal.ativo = False
    db.commit()
    return None