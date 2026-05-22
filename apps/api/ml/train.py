"""
Treino do modelo preditivo de prenhez para o Unum.

Pipeline:
1. Carrega eventos_consolidado.csv (gerado por data_synth.py).
2. Separa features (X) e target (y = prenhe/vazia).
3. Treina GradientBoostingClassifier com pré-processamento (OneHotEncoder).
4. Avalia com hold-out 80/20 + cross-validation 5-fold.
5. Salva o modelo em ml/models/prenhez_v1.joblib.
6. Salva métricas em ml/models/metricas_v1.json.

Uso:
    docker compose exec api python -m ml.train
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from joblib import dump
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

# ---------------------------------------------------------------------------
# Definição de features
# ---------------------------------------------------------------------------

FEATURES_NUMERICAS = [
    "idade_matriz",
    "paridade",
    "ecc",
    "historico_matriz",
    "taxa_reprodutor",
    "mes",
    "estacao_favoravel",
    # v0.2.0 — features derivadas do ciclo reprodutivo.
    "tentativa_no_ciclo",
    "dias_desde_parto",
    "ciclos_anteriores_falha",
]
FEATURES_CATEGORICAS = [
    "especie",
    "raca_matriz",
    "raca_reprodutor",
    "tecnica",
]
TARGET = "resultado"

MODELO_VERSAO = "v0.2.0"
DATA_DIR = Path("ml/data")
MODELS_DIR = Path("ml/models")


def carregar_dados() -> pd.DataFrame:
    """Carrega o dataset consolidado, removendo colunas que vazariam o resultado."""
    path = DATA_DIR / "eventos_consolidado.csv"
    if not path.exists():
        raise FileNotFoundError(
            f"Arquivo {path} não encontrado. "
            f"Rode antes: python -m ml.data_synth"
        )
    df = pd.read_csv(path)
    df = df.drop(columns=["prob_verdadeira"], errors="ignore")
    return df


def construir_pipeline() -> Pipeline:
    """Pipeline: pré-processamento + modelo."""
    preproc = ColumnTransformer(
        transformers=[
            ("num", "passthrough", FEATURES_NUMERICAS),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), FEATURES_CATEGORICAS),
        ]
    )
    clf = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        random_state=42,
    )
    return Pipeline([("preproc", preproc), ("clf", clf)])


def treinar() -> dict:
    print("Carregando dados...")
    df = carregar_dados()
    print(f"  Total de eventos: {len(df)}")
    print(f"  Taxa de prenhez geral: {(df[TARGET] == 'prenhe').mean():.1%}")

    X = df[FEATURES_NUMERICAS + FEATURES_CATEGORICAS]
    y = (df[TARGET] == "prenhe").astype(int)

    print("\nDividindo treino/teste (80/20)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    print(f"  Treino: {len(X_train)} | Teste: {len(X_test)}")

    print("\nTreinando GradientBoostingClassifier...")
    pipe = construir_pipeline()
    pipe.fit(X_train, y_train)

    print("\nAvaliando no conjunto de teste...")
    y_pred = pipe.predict(X_test)
    y_proba = pipe.predict_proba(X_test)[:, 1]
    auc_test = roc_auc_score(y_test, y_proba)
    print(f"  AUC ROC (teste): {auc_test:.3f}")

    print("\nCross-validation 5-fold...")
    cv_scores = cross_val_score(pipe, X, y, cv=5, scoring="roc_auc", n_jobs=-1)
    print(f"  AUC ROC médio: {cv_scores.mean():.3f} (+/- {cv_scores.std() * 2:.3f})")

    print("\nRelatório de classificação:")
    print(classification_report(y_test, y_pred, target_names=["vazia", "prenhe"]))

    metricas = {
        "modelo_versao": MODELO_VERSAO,
        "treinado_em": datetime.now(timezone.utc).isoformat(),
        "n_treino": int(len(X_train)),
        "n_teste": int(len(X_test)),
        "auc_test": float(auc_test),
        "cv_auc_mean": float(cv_scores.mean()),
        "cv_auc_std": float(cv_scores.std()),
        "classification_report": classification_report(
            y_test, y_pred, target_names=["vazia", "prenhe"], output_dict=True
        ),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "features_numericas": FEATURES_NUMERICAS,
        "features_categoricas": FEATURES_CATEGORICAS,
    }

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    modelo_path = MODELS_DIR / "prenhez_v1.joblib"
    metricas_path = MODELS_DIR / "metricas_v1.json"

    print(f"\nSalvando modelo em {modelo_path}...")
    dump(pipe, modelo_path)

    print(f"Salvando métricas em {metricas_path}...")
    with open(metricas_path, "w") as f:
        json.dump(metricas, f, indent=2)

    print("\n" + "=" * 60)
    print(f"Treino concluído! AUC ROC: {auc_test:.3f}")
    print("=" * 60)
    return metricas


if __name__ == "__main__":
    treinar()