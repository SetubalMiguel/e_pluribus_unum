"""
Serviço de recomendação de cruzamentos.

Para uma matriz dada, roda o PrenhezPredictor contra todos os reprodutores
disponíveis (mesma espécie, ativos) e retorna os top-N por probabilidade.

Inclui filtro de parentesco heurístico baseado em linhagem para evitar
recomendar consanguinidade óbvia.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Animal, Inseminacao, ResultadoDiagnostico, Sexo
from app.services.predictor import PrenhezPredictor


def _eh_aparentado(matriz: Animal, reprodutor: Animal) -> bool:
    """
    Heurística simples de parentesco baseada em linhagem.

    Em produção, isso usaria pedigree real. No MVP, evitamos cruzar animais
    de linhagem idêntica não-nula como proxy para reduzir consanguinidade.
    """
    if not matriz.linhagem or not reprodutor.linhagem:
        return False
    return matriz.linhagem.strip().lower() == reprodutor.linhagem.strip().lower()


def _calcular_taxa_reprodutor(db: Session, reprodutor_id) -> float:
    """Taxa histórica de sucesso do reprodutor (fallback: 0.55)."""
    stmt = select(Inseminacao.resultado_diagnostico).where(
        Inseminacao.reprodutor_id == reprodutor_id
    )
    resultados = db.execute(stmt).scalars().all()
    if not resultados:
        return 0.55
    sucessos = sum(1 for r in resultados if r == ResultadoDiagnostico.PRENHE)
    return sucessos / len(resultados)


def _calcular_taxa_matriz(db: Session, matriz_id) -> float:
    """Taxa histórica de sucesso da matriz."""
    stmt = select(Inseminacao.resultado_diagnostico).where(
        Inseminacao.matriz_id == matriz_id
    )
    resultados = db.execute(stmt).scalars().all()
    if not resultados:
        return 0.55
    sucessos = sum(1 for r in resultados if r == ResultadoDiagnostico.PRENHE)
    return sucessos / len(resultados)


def recomendar_cruzamentos(
    db: Session,
    matriz: Animal,
    tecnica: str,
    data_evento: date,
    top_n: int = 5,
    *,
    filtrar_parentesco: bool = True,
) -> list[dict[str, Any]]:
    """
    Roda o PrenhezPredictor contra todos os reprodutores compatíveis
    e retorna os top-N ordenados por probabilidade.
    """
    predictor = PrenhezPredictor()

    # Busca reprodutores compatíveis: mesma espécie, sexo macho, ativos
    stmt = select(Animal).where(
        Animal.especie == matriz.especie,
        Animal.sexo == Sexo.MACHO,
        Animal.ativo.is_(True),
    )
    reprodutores = list(db.execute(stmt).scalars().all())

    if not reprodutores:
        return []

    # Dados da matriz (calculados uma vez)
    dg_matriz = matriz.dados_geneticos or {}
    idade_matriz = float(dg_matriz.get("idade_anos", 3.0))
    paridade = int(dg_matriz.get("paridade", 0))
    ecc = float(dg_matriz.get("ecc", 3.0))
    historico_matriz = float(
        dg_matriz.get("historico_sucesso") or _calcular_taxa_matriz(db, matriz.id)
    )

    candidatos: list[dict[str, Any]] = []

    for reprodutor in reprodutores:
        # Filtro de parentesco
        if filtrar_parentesco and _eh_aparentado(matriz, reprodutor):
            continue

        dg_rep = reprodutor.dados_geneticos or {}
        taxa_rep = float(
            dg_rep.get("taxa_sucesso_historica")
            or _calcular_taxa_reprodutor(db, reprodutor.id)
        )

        features = PrenhezPredictor.montar_features(
            especie=matriz.especie.value,
            raca_matriz=matriz.raca or "Mestico",
            raca_reprodutor=reprodutor.raca or "Mestico",
            tecnica=tecnica,
            data_evento=data_evento,
            idade_matriz=idade_matriz,
            paridade=paridade,
            ecc=ecc,
            historico_matriz=historico_matriz,
            taxa_reprodutor=taxa_rep,
        )

        predicao = predictor.predict(features)

        candidatos.append({
            "reprodutor": reprodutor,
            "predicao": predicao,
        })

    # Ordena por probabilidade decrescente
    candidatos.sort(
        key=lambda c: c["predicao"]["probabilidade_prenhez"],
        reverse=True,
    )

    return candidatos[:top_n]