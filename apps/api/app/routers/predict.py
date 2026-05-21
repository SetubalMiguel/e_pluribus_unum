"""Router de predição de prenhez."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Animal, Inseminacao, ResultadoDiagnostico, Sexo
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