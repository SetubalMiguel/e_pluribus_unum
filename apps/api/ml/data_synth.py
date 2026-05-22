"""
Gerador de dados sintéticos para o Unum.

Baseado em literatura zootécnica brasileira (Embrapa Gado de Corte,
Embrapa Caprinos e Ovinos, ABCZ, ASBIA). NÃO substitui dados reais.

A partir do v0.2.0 a geração roda *por ciclo reprodutivo*:

- cada matriz percorre N ciclos em sequência (cio → 1..3 tentativas →
  prenhe ou falha → próximo ciclo após puerpério);
- isso introduz 3 features novas que o modelo v1 não enxergava:
  `tentativa_no_ciclo`, `dias_desde_parto` e `ciclos_anteriores_falha`.

Distribuições calibradas para gerar taxas de prenhez realistas em
sistemas de produção do semiárido nordestino:
- Bovinos IATF: 45–55%
- Ovinos IA cervical: 40–60%
- Caprinos IA laparoscópica: 65–80%
"""
from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

rng = np.random.default_rng(seed=42)

# --------------------------- Configurações por espécie ---------------------

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
        # Gestação média (dias) — usada para calcular parto_data e o puerpério.
        "gestacao_dias": 283,
        # Mínimo de dias entre tentativas dentro do mesmo ciclo.
        "intervalo_tentativa": (21, 32),
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
        "gestacao_dias": 150,
        "intervalo_tentativa": (16, 22),
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
        "gestacao_dias": 150,
        "intervalo_tentativa": (18, 24),
    },
}

# Sentinela para "matriz que nunca pariu" no campo dias_desde_parto.
DIAS_PARTO_NULIPARA = -1

# --------------------------- Geração de animais ----------------------------

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

# --------------------------- Modificadores de probabilidade ----------------

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


def _modificador_tentativa(tentativa: int) -> float:
    """Repeat-breeding penalty — cada falha anterior no ciclo deprime a chance."""
    if tentativa == 1:
        return 0.02
    if tentativa == 2:
        return -0.10
    return -0.20  # 3+ tentativas: matriz problemática nesse cio


def _modificador_dias_parto(dias: int) -> float:
    """
    Curva clássica do período voluntário pós-parto:
    - <50d: involução uterina incompleta → −0.25
    - 50–90d: período voluntário, ainda subótimo → −0.10
    - 90–150d: janela ideal → +0.05
    - 150–220d: neutro
    - >220d: vaca "atrasando" o cio → −0.05
    - −1 (nulípara/sem parto registrado): leve penalidade (primeira IA)
    """
    if dias == DIAS_PARTO_NULIPARA:
        return -0.03
    if dias < 50:
        return -0.25
    if dias < 90:
        return -0.10
    if dias < 150:
        return 0.05
    if dias < 220:
        return 0.0
    return -0.05


def _modificador_ciclos_falha(n: int) -> float:
    """Histórico crônico de falha sinaliza problema reprodutivo subjacente."""
    if n == 0:
        return 0.02
    if n == 1:
        return -0.05
    if n == 2:
        return -0.12
    return -0.20

# --------------------------- Loop por ciclo reprodutivo --------------------

def _gerar_eventos_por_ciclos(
    matrizes: pd.DataFrame,
    reprodutores: pd.DataFrame,
    especie: str,
    *,
    janela_inicio: date,
    janela_fim: date,
    media_ciclos_por_matriz: float,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Para cada matriz, percorre ciclos sequenciais até estourar a janela.
    Retorna (eventos_df, ciclos_df).
    """
    cfg = ESPECIES_CONFIG[especie]
    tecnicas = list(cfg["tecnicas"].keys())
    pesos_tec = list(cfg["tecnicas"].values())
    gestacao_dias = cfg["gestacao_dias"]
    int_tent_lo, int_tent_hi = cfg["intervalo_tentativa"]

    eventos: list[dict] = []
    ciclos: list[dict] = []

    # Pré-sorteia número de ciclos por matriz (Poisson em torno da média).
    n_ciclos_por_matriz = rng.poisson(media_ciclos_por_matriz, len(matrizes))
    n_ciclos_por_matriz = np.clip(n_ciclos_por_matriz, 1, 6)

    for m_idx, matriz in matrizes.iterrows():
        # Estado evolutivo da matriz ao longo dos ciclos.
        parto_anterior: date | None = None
        ciclos_falha_acum = 0

        # Inicia em um dia aleatório dentro da janela.
        cursor = janela_inicio + timedelta(
            days=int(rng.integers(0, max(1, (janela_fim - janela_inicio).days // 4)))
        )

        for c_idx in range(int(n_ciclos_por_matriz[m_idx])):
            if cursor >= janela_fim:
                break

            ciclo_id = f"C-{matriz['matriz_id']}-{c_idx:02d}"
            cio = cursor
            cycle_status = "ativo"
            parto_data: date | None = None
            ultima_tentativa: date | None = None
            n_tentativas_total = 0

            # Até 3 tentativas dentro deste ciclo.
            for tentativa in range(1, 4):
                if cursor >= janela_fim:
                    break

                tecnica = rng.choice(tecnicas, p=pesos_tec)
                reprodutor = reprodutores.iloc[rng.integers(0, len(reprodutores))]

                dias_desde_parto = (
                    (cursor - parto_anterior).days if parto_anterior else DIAS_PARTO_NULIPARA
                )

                prob = cfg["taxa_base"][tecnica]
                prob += _modificador_ecc(matriz["ecc"], cfg["ecc_ideal"])
                prob += _modificador_idade(matriz["idade"], cfg["idade_ideal"])
                prob += _modificador_estacao(cursor.month, cfg["estacao_pico"])
                prob += _modificador_paridade(int(matriz["paridade"]))
                prob += (reprodutor["taxa_sucesso_historica"] - 0.55) * 0.4
                prob += (matriz["historico_sucesso"] - 0.55) * 0.2
                # === Novos modificadores derivados do ciclo ===
                prob += _modificador_tentativa(tentativa)
                prob += _modificador_dias_parto(dias_desde_parto)
                prob += _modificador_ciclos_falha(ciclos_falha_acum)
                # Ruído individual por evento.
                prob += rng.normal(0, 0.05)
                prob = float(np.clip(prob, 0.05, 0.95))

                deu_prenhe = rng.random() < prob
                resultado = "prenhe" if deu_prenhe else "vazia"
                n_tentativas_total = tentativa
                ultima_tentativa = cursor

                eventos.append({
                    "evento_id": f"E-{especie[:2].upper()}-{len(eventos):06d}",
                    "ciclo_id": ciclo_id,
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
                    "mes": cursor.month,
                    "estacao_favoravel": int(cursor.month in cfg["estacao_pico"]),
                    "data_evento": cursor.isoformat(),
                    # Novas features
                    "tentativa_no_ciclo": tentativa,
                    "dias_desde_parto": int(dias_desde_parto),
                    "ciclos_anteriores_falha": int(ciclos_falha_acum),
                    "prob_verdadeira": round(prob, 3),
                    "resultado": resultado,
                })

                if deu_prenhe:
                    parto_data = cursor + timedelta(days=gestacao_dias)
                    cycle_status = "concluido_sucesso"
                    break

                # Espera até a próxima tentativa (próximo cio).
                cursor = cursor + timedelta(
                    days=int(rng.integers(int_tent_lo, int_tent_hi + 1))
                )

            # Fecha o ciclo.
            if cycle_status != "concluido_sucesso":
                cycle_status = "concluido_falha"
                ciclos_falha_acum += 1
                # Avança para o próximo cio "natural" — 1–2 meses depois.
                proxima_data = (ultima_tentativa or cio) + timedelta(
                    days=int(rng.integers(30, 70))
                )
            else:
                ciclos_falha_acum = 0
                parto_anterior = parto_data
                # Próximo ciclo começa após puerpério mínimo (≈ 60d).
                proxima_data = (parto_data or cio) + timedelta(
                    days=int(rng.integers(60, 120))
                )

            ciclos.append({
                "ciclo_id": ciclo_id,
                "matriz_id": matriz["matriz_id"],
                "especie": especie,
                "data_inicio": cio.isoformat(),
                "data_fim": (ultima_tentativa or cio).isoformat(),
                "status": cycle_status,
                "parto_data": parto_data.isoformat() if parto_data else None,
                "tentativas": n_tentativas_total,
            })

            cursor = proxima_data

    return pd.DataFrame(eventos), pd.DataFrame(ciclos)

# --------------------------- Orquestrador ----------------------------------

def gerar_dataset_completo(
    n_matrizes_por_especie: int = 500,
    n_reprodutores_por_especie: int = 40,
    media_ciclos_por_matriz: float = 5.5,
    janela_inicio: date = date(2023, 1, 1),
    janela_fim: date = date(2026, 5, 1),
    output_dir: str | Path = "ml/data",
) -> dict[str, dict[str, float]]:
    """
    Gera matrizes, reprodutores, ciclos e eventos para as 3 espécies e
    grava CSVs em `output_dir`. Retorna métricas por espécie.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    resultado: dict[str, dict[str, float]] = {}
    todos_eventos: list[pd.DataFrame] = []
    todos_ciclos: list[pd.DataFrame] = []

    for especie in ["bovino", "ovino", "caprino"]:
        print(f"Gerando dados para {especie}...")
        matrizes = gerar_matrizes(especie, n_matrizes_por_especie)
        reprodutores = gerar_reprodutores(especie, n_reprodutores_por_especie)
        eventos, ciclos = _gerar_eventos_por_ciclos(
            matrizes, reprodutores, especie,
            janela_inicio=janela_inicio,
            janela_fim=janela_fim,
            media_ciclos_por_matriz=media_ciclos_por_matriz,
        )

        matrizes.to_csv(output_dir / f"matrizes_{especie}.csv", index=False)
        reprodutores.to_csv(output_dir / f"reprodutores_{especie}.csv", index=False)
        ciclos.to_csv(output_dir / f"ciclos_{especie}.csv", index=False)
        eventos.to_csv(output_dir / f"eventos_{especie}.csv", index=False)

        taxa_evento = (eventos["resultado"] == "prenhe").mean()
        taxa_ciclo = (ciclos["status"] == "concluido_sucesso").mean()
        print(
            f"  {len(eventos)} eventos em {len(ciclos)} ciclos | "
            f"taxa por evento: {taxa_evento:.1%} | "
            f"taxa por ciclo: {taxa_ciclo:.1%}"
        )
        resultado[especie] = {
            "n_eventos": float(len(eventos)),
            "n_ciclos": float(len(ciclos)),
            "taxa_por_evento": float(taxa_evento),
            "taxa_por_ciclo": float(taxa_ciclo),
        }
        todos_eventos.append(eventos)
        todos_ciclos.append(ciclos)

    consolidado_eventos = pd.concat(todos_eventos, ignore_index=True)
    consolidado_ciclos = pd.concat(todos_ciclos, ignore_index=True)
    consolidado_eventos.to_csv(output_dir / "eventos_consolidado.csv", index=False)
    consolidado_ciclos.to_csv(output_dir / "ciclos_consolidado.csv", index=False)
    print(
        f"\nDataset consolidado: {len(consolidado_eventos)} eventos em "
        f"{len(consolidado_ciclos)} ciclos → {output_dir}/"
    )
    return resultado


if __name__ == "__main__":
    gerar_dataset_completo()
