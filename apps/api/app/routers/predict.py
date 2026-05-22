"""Router de predição de prenhez."""
from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import (
    Animal,
    CicloReprodutivo,
    Inseminacao,
    ResultadoDiagnostico,
    Sexo,
    StatusCiclo,
)
from app.schemas.predict import PredictRequest, PredictResponse
from app.services.predictor import PrenhezPredictor, get_predictor

router = APIRouter(prefix="/predict", tags=["IA"])


@router.post(
    "",
    response_model=PredictResponse,
    summary="Prediz a probabilidade de prenhez para uma inseminação proposta",
)
def predict_prenhez(
    payload: PredictRequest,
    db: Session = Depends(get_db),
    predictor: PrenhezPredictor = Depends(get_predictor),
) -> PredictResponse:
    matriz = db.get(Animal, payload.matriz_id)
    if matriz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Matriz não encontrada")
    if matriz.sexo != Sexo.FEMEA:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Matriz deve ser fêmea")

    reprodutor = db.get(Animal, payload.reprodutor_id)
    if reprodutor is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reprodutor não encontrado")
    if reprodutor.sexo != Sexo.MACHO:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reprodutor deve ser macho")
    if reprodutor.especie != matriz.especie:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Matriz e reprodutor devem ser da mesma espécie",
        )

    dg_matriz = matriz.dados_geneticos or {}
    dg_reprodutor = reprodutor.dados_geneticos or {}

    idade_matriz = float(dg_matriz.get("idade_anos", 3.0))
    paridade = int(dg_matriz.get("paridade", 0))
    ecc = float(dg_matriz.get("ecc", 3.0))
    historico_matriz = float(dg_matriz.get("historico_sucesso", 0.55))
    taxa_reprodutor = float(dg_reprodutor.get("taxa_sucesso_historica", 0.55))

    if "historico_sucesso" not in dg_matriz:
        historico_matriz = _calcular_taxa_real(db, matriz.id, como_matriz=True)
    if "taxa_sucesso_historica" not in dg_reprodutor:
        taxa_reprodutor = _calcular_taxa_real(db, reprodutor.id, como_matriz=False)

    # Contexto de ciclo (introduzido no modelo v0.2.0). Valores default são
    # conservadores quando a matriz ainda não tem ciclos cadastrados.
    tentativa_no_ciclo = _tentativa_no_ciclo_atual(db, matriz.id, payload.data_evento)
    dias_desde_parto = _dias_desde_ultimo_parto(db, matriz.id, payload.data_evento)
    ciclos_falha = _contar_ciclos_falha(db, matriz.id)

    features = PrenhezPredictor.montar_features(
        especie=matriz.especie.value,
        raca_matriz=matriz.raca or "Mestico",
        raca_reprodutor=reprodutor.raca or "Mestico",
        tecnica=payload.tecnica.value,
        data_evento=payload.data_evento,
        idade_matriz=idade_matriz,
        paridade=paridade,
        ecc=ecc,
        historico_matriz=historico_matriz,
        taxa_reprodutor=taxa_reprodutor,
        tentativa_no_ciclo=tentativa_no_ciclo,
        dias_desde_parto=dias_desde_parto,
        ciclos_anteriores_falha=ciclos_falha,
    )

    resultado = predictor.predict(features)
    return PredictResponse(**resultado)


def _calcular_taxa_real(db: Session, animal_id, *, como_matriz: bool) -> float:
    """Calcula taxa histórica de sucesso a partir do banco."""
    coluna = Inseminacao.matriz_id if como_matriz else Inseminacao.reprodutor_id
    stmt = select(Inseminacao.resultado_diagnostico).where(coluna == animal_id)
    resultados = db.execute(stmt).scalars().all()
    if not resultados:
        return 0.55
    sucessos = sum(1 for r in resultados if r == ResultadoDiagnostico.PRENHE)
    return sucessos / len(resultados)


def _tentativa_no_ciclo_atual(
    db: Session, matriz_id: UUID, data_evento: date
) -> int:
    """
    Número da próxima tentativa dentro do ciclo aberto da matriz.
    Conta IAs registradas nesse ciclo até `data_evento` e soma 1.
    Sem ciclo aberto → assume primeira tentativa.
    """
    ciclo = db.execute(
        select(CicloReprodutivo)
        .where(
            and_(
                CicloReprodutivo.matriz_id == matriz_id,
                CicloReprodutivo.status == StatusCiclo.ATIVO,
            )
        )
        .order_by(CicloReprodutivo.data_inicio.desc())
        .limit(1)
    ).scalar_one_or_none()
    if ciclo is None:
        return 1
    limite = datetime.combine(data_evento, datetime.min.time())
    tentativas_anteriores = db.execute(
        select(func.count(Inseminacao.id)).where(
            and_(
                Inseminacao.matriz_id == matriz_id,
                Inseminacao.data_evento >= datetime.combine(
                    ciclo.data_inicio, datetime.min.time()
                ),
                Inseminacao.data_evento < limite,
            )
        )
    ).scalar_one()
    return int(tentativas_anteriores) + 1


def _dias_desde_ultimo_parto(
    db: Session, matriz_id: UUID, data_evento: date
) -> int:
    """
    Dias entre `data_evento` e o último parto registrado da matriz.
    Retorna -1 quando a matriz nunca pariu (nulípara ou sem histórico).
    """
    ultimo_parto = db.execute(
        select(CicloReprodutivo.parto_data)
        .where(
            and_(
                CicloReprodutivo.matriz_id == matriz_id,
                CicloReprodutivo.parto_data.is_not(None),
                CicloReprodutivo.parto_data <= data_evento,
            )
        )
        .order_by(CicloReprodutivo.parto_data.desc())
        .limit(1)
    ).scalar_one_or_none()
    if ultimo_parto is None:
        return -1
    return (data_evento - ultimo_parto).days


def _contar_ciclos_falha(db: Session, matriz_id: UUID) -> int:
    """Quantos ciclos da matriz foram fechados com falha (proxy de subfertilidade)."""
    total = db.execute(
        select(func.count(CicloReprodutivo.id)).where(
            and_(
                CicloReprodutivo.matriz_id == matriz_id,
                CicloReprodutivo.status == StatusCiclo.CONCLUIDO_FALHA,
            )
        )
    ).scalar_one()
    return int(total)