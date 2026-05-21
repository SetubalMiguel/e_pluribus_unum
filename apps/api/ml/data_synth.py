"""
Gerador de dados sintéticos para o Unum.

Baseado em literatura zootécnica brasileira (Embrapa Gado de Corte,
Embrapa Caprinos e Ovinos, ABCZ, ASBIA). NÃO substitui dados reais.

Distribuições calibradas para gerar taxas de prenhez realistas em
sistemas de produção do semiárido nordestino:
- Bovinos IATF: 45-55%
- Ovinos IA cervical: 40-60%
- Caprinos IA laparoscópica: 65-80%
"""
from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

rng = np.random.default_rng(seed=42)

# Configurações por espécie -------------------------------------------------

ESPECIES_CONFIG: dict[str, dict] = {
    "bovino": {
        "racas": {
            "Nelore": 0.45, "Senepol": 0.15, "Angus": 0.10,
            "Brahman": 0.10, "Gir": 0.08, "Guzera": 0.07,
            "Mestico": 0.05,
        },
        "tecnicas": {"IATF": 0.70, "convencional": 0.25, "IA_repasse": 0.05},
        "taxa_base": {"IATF": 0.50, "convencional": 0.60, "IA_repasse": 0.40},
        "idade_ideal": (3, 8),
        "ecc_ideal": (3.0, 3.5),
        "estacao_pico": [10, 11, 12, 1, 2, 3],
    },
    "ovino": {
        "racas": {
            "Santa Ines": 0.50, "Morada Nova": 0.15, "Somalis": 0.10,
            "Dorper": 0.10, "White Dorper": 0.08, "Mestico": 0.07,
        },
        "tecnicas": {"IA_cervical": 0.60, "IA_laparoscopica": 0.15, "IATF": 0.25},
        "taxa_base": {"IA_cervical": 0.50, "IA_laparoscopica": 0.68, "IATF": 0.55},
        "idade_ideal": (1, 5),
        "ecc_ideal": (3.0, 3.5),
        "estacao_pico": [2, 3, 4, 5],
    },
    "caprino": {
        "racas": {
            "Anglo Nubiana": 0.30, "Boer": 0.20, "Saanen": 0.15,
            "Alpina": 0.10, "Pardo Alpina": 0.10, "Caninde": 0.08,
            "Moxoto": 0.07,
        },
        "tecnicas": {"IA_cervical": 0.55, "IA_laparoscopica": 0.20, "IATF": 0.25},
        "taxa_base": {"IA_cervical": 0.55, "IA_laparoscopica": 0.72, "IATF": 0.58},
        "idade_ideal": (1, 6),
        "ecc_ideal": (2.8, 3.5),
        "estacao_pico": [3, 4, 5, 6],
    },
}

# Geração de animais --------------------------------------------------------

def gerar_matrizes(especie: str, n: int) -> pd.DataFrame:
    cfg = ESPECIES_CONFIG[especie]
    racas = list(cfg["racas"].keys())
    pesos = list(cfg["racas"].values())

    return pd.DataFrame({
        "matriz_id": [f"{especie[:2].upper()}-M-{i:05d}" for i in range(n)],
        "especie": especie,
        "raca": rng.choice(racas, n, p=pesos),
        "idade": rng.uniform(1, 10, n).round(1),
        "paridade": rng.integers(0, 6, n),
        "ecc": np.clip(rng.normal(3.2, 0.5, n), 1.5, 5.0).round(1),
        "historico_sucesso": np.clip(rng.normal(0.55, 0.20, n), 0, 1).round(2),
    })


def gerar_reprodutores(especie: str, n: int) -> pd.DataFrame:
    cfg = ESPECIES_CONFIG[especie]
    racas = list(cfg["racas"].keys())
    pesos = list(cfg["racas"].values())

    return pd.DataFrame({
        "reprodutor_id": [f"{especie[:2].upper()}-R-{i:04d}" for i in range(n)],
        "especie": especie,
        "raca": rng.choice(racas, n, p=pesos),
        "idade": rng.uniform(2, 8, n).round(1),
        "taxa_sucesso_historica": np.clip(rng.beta(7, 4, n), 0.30, 0.95).round(2),
    })

# Modificadores de probabilidade --------------------------------------------

def _modificador_ecc(ecc: float, ideal: tuple[float, float]) -> float:
    lo, hi = ideal
    if lo <= ecc <= hi:
        return 0.12
    if ecc < lo - 0.5 or ecc > hi + 0.5:
        return -0.15
    return -0.05


def _modificador_idade(idade: float, ideal: tuple[int, int]) -> float:
    lo, hi = ideal
    return 0.05 if lo <= idade <= hi else -0.08


def _modificador_estacao(mes: int, pico: list[int]) -> float:
    return 0.05 if mes in pico else -0.03


def _modificador_paridade(paridade: int) -> float:
    if paridade == 0:
        return -0.05
    if 2 <= paridade <= 4:
        return 0.05
    if paridade >= 5:
        return -0.03
    return 0.0

# Geração de eventos de inseminação -----------------------------------------

def gerar_inseminacoes(
    matrizes: pd.DataFrame,
    reprodutores: pd.DataFrame,
    especie: str,
    n_eventos: int,
) -> pd.DataFrame:
    cfg = ESPECIES_CONFIG[especie]
    tecnicas = list(cfg["tecnicas"].keys())
    pesos_tec = list(cfg["tecnicas"].values())

    eventos = []
    data_inicio = date(2024, 1, 1)

    # Pré-sorteia para velocidade
    idx_matrizes = rng.integers(0, len(matrizes), n_eventos)
    idx_reprodutores = rng.integers(0, len(reprodutores), n_eventos)
    tecnicas_sorteadas = rng.choice(tecnicas, n_eventos, p=pesos_tec)
    dias_offset = rng.integers(0, 730, n_eventos)
    ruido = rng.normal(0, 0.05, n_eventos)
    sorteio_resultado = rng.random(n_eventos)

    for i in range(n_eventos):
        matriz = matrizes.iloc[idx_matrizes[i]]
        reprodutor = reprodutores.iloc[idx_reprodutores[i]]
        tecnica = tecnicas_sorteadas[i]
        data_evento = data_inicio + timedelta(days=int(dias_offset[i]))

        prob = cfg["taxa_base"][tecnica]
        prob += _modificador_ecc(matriz["ecc"], cfg["ecc_ideal"])
        prob += _modificador_idade(matriz["idade"], cfg["idade_ideal"])
        prob += _modificador_estacao(data_evento.month, cfg["estacao_pico"])
        prob += _modificador_paridade(matriz["paridade"])
        prob += (reprodutor["taxa_sucesso_historica"] - 0.55) * 0.4
        prob += (matriz["historico_sucesso"] - 0.55) * 0.2
        prob += ruido[i]
        prob = float(np.clip(prob, 0.05, 0.95))

        resultado = "prenhe" if sorteio_resultado[i] < prob else "vazia"

        eventos.append({
            "evento_id": f"E-{especie[:2].upper()}-{i:06d}",
            "matriz_id": matriz["matriz_id"],
            "reprodutor_id": reprodutor["reprodutor_id"],
            "especie": especie,
            "raca_matriz": matriz["raca"],
            "raca_reprodutor": reprodutor["raca"],
            "idade_matriz": matriz["idade"],
            "paridade": matriz["paridade"],
            "ecc": matriz["ecc"],
            "historico_matriz": matriz["historico_sucesso"],
            "taxa_reprodutor": reprodutor["taxa_sucesso_historica"],
            "tecnica": tecnica,
            "mes": data_evento.month,
            "estacao_favoravel": int(data_evento.month in cfg["estacao_pico"]),
            "data_evento": data_evento.isoformat(),
            "prob_verdadeira": round(prob, 3),
            "resultado": resultado,
        })

    return pd.DataFrame(eventos)

# Orquestrador --------------------------------------------------------------

def gerar_dataset_completo(
    n_matrizes_por_especie: int = 300,
    n_reprodutores_por_especie: int = 30,
    n_eventos_por_especie: int = 1500,
    output_dir: str | Path = "ml/data",
) -> dict[str, float]:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    resultado: dict[str, float] = {}
    todos_eventos = []

    for especie in ["bovino", "ovino", "caprino"]:
        print(f"Gerando dados para {especie}...")
        matrizes = gerar_matrizes(especie, n_matrizes_por_especie)
        reprodutores = gerar_reprodutores(especie, n_reprodutores_por_especie)
        eventos = gerar_inseminacoes(matrizes, reprodutores, especie, n_eventos_por_especie)

        matrizes.to_csv(output_dir / f"matrizes_{especie}.csv", index=False)
        reprodutores.to_csv(output_dir / f"reprodutores_{especie}.csv", index=False)
        eventos.to_csv(output_dir / f"eventos_{especie}.csv", index=False)

        taxa = (eventos["resultado"] == "prenhe").mean()
        print(f"  {n_eventos_por_especie} eventos | taxa de prenhez: {taxa:.1%}")
        resultado[especie] = float(taxa)
        todos_eventos.append(eventos)

    consolidado = pd.concat(todos_eventos, ignore_index=True)
    consolidado.to_csv(output_dir / "eventos_consolidado.csv", index=False)
    print(f"\nDataset consolidado: {len(consolidado)} eventos em {output_dir}/")
    return resultado


if __name__ == "__main__":
    gerar_dataset_completo()