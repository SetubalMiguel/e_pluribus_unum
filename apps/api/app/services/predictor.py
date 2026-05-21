"""
Serviço de predição de prenhez.

O modelo é carregado uma vez na inicialização (cold start ~200ms)
e fica em memória para responder predições em ~5-20ms cada.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from threading import Lock
from typing import Any

import numpy as np
import pandas as pd
from joblib import load

MODELOS_DIR = Path("ml/models")
MODELO_PATH = MODELOS_DIR / "prenhez_v1.joblib"
METRICAS_PATH = MODELOS_DIR / "metricas_v1.json"

# Estação favorável por espécie (mesmo critério usado no data_synth)
ESTACAO_PICO = {
    "bovino": {10, 11, 12, 1, 2, 3},
    "ovino": {2, 3, 4, 5},
    "caprino": {3, 4, 5, 6},
}


class PrenhezPredictor:
    """Singleton thread-safe que carrega o modelo uma vez."""

    _instance: "PrenhezPredictor | None" = None
    _lock = Lock()

    def __new__(cls) -> "PrenhezPredictor":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._init()
        return cls._instance

    def _init(self) -> None:
        if not MODELO_PATH.exists():
            raise FileNotFoundError(
                f"Modelo não encontrado em {MODELO_PATH}. "
                f"Rode antes: docker compose exec api python -m ml.train"
            )
        self.modelo = load(MODELO_PATH)
        with open(METRICAS_PATH) as f:
            self.metricas = json.load(f)
        self.versao = self.metricas["modelo_versao"]

        preproc = self.modelo.named_steps["preproc"]
        self._feature_names: list[str] = list(preproc.get_feature_names_out())
        self._classifier = self.modelo.named_steps["clf"]

    def predict(self, features: dict[str, Any]) -> dict[str, Any]:
        df = pd.DataFrame([features])
        proba = float(self.modelo.predict_proba(df)[0, 1])
        fatores = self._explicar(df, proba)

        return {
            "probabilidade_prenhez": round(proba, 3),
            "classificacao": self._classificar(proba),
            "fatores_positivos": fatores["positivos"],
            "fatores_negativos": fatores["negativos"],
            "modelo_versao": self.versao,
            "auc_referencia": round(self.metricas["cv_auc_mean"], 3),
        }

    @staticmethod
    def montar_features(
        especie: str,
        raca_matriz: str,
        raca_reprodutor: str,
        tecnica: str,
        data_evento: date,
        idade_matriz: float,
        paridade: int,
        ecc: float,
        historico_matriz: float,
        taxa_reprodutor: float,
    ) -> dict[str, Any]:
        mes = data_evento.month
        estacao_favoravel = int(mes in ESTACAO_PICO.get(especie, set()))
        return {
            "idade_matriz": float(idade_matriz),
            "paridade": int(paridade),
            "ecc": float(ecc),
            "historico_matriz": float(historico_matriz),
            "taxa_reprodutor": float(taxa_reprodutor),
            "mes": int(mes),
            "estacao_favoravel": int(estacao_favoravel),
            "especie": especie,
            "raca_matriz": raca_matriz,
            "raca_reprodutor": raca_reprodutor,
            "tecnica": tecnica,
        }

    @staticmethod
    def _classificar(proba: float) -> str:
        if proba >= 0.70:
            return "alta"
        if proba >= 0.45:
            return "media"
        return "baixa"

    def _explicar(self, df: pd.DataFrame, proba: float) -> dict[str, list[dict]]:
        """
        Aproximação de explicabilidade baseada em feature_importances_
        ponderada pelo valor da feature. Honesta mas leve.
        Em iteração futura: trocar por shap.TreeExplainer.
        """
        preproc = self.modelo.named_steps["preproc"]
        X_transformed = preproc.transform(df)

        importances = self._classifier.feature_importances_
        contribuicoes = X_transformed[0] * importances

        idx_top = np.argsort(np.abs(contribuicoes))[::-1][:8]

        positivos: list[dict] = []
        negativos: list[dict] = []
        sinal = 1 if proba >= 0.5 else -1

        for idx in idx_top:
            nome_tecnico = self._feature_names[idx]
            valor_feature = float(X_transformed[0][idx])
            impacto = float(contribuicoes[idx])
            impacto_pct = round(impacto * sinal * 100, 1)

            item = {
                "feature": self._traduzir(nome_tecnico),
                "valor": round(valor_feature, 2),
                "impacto_relativo": impacto_pct,
            }

            if impacto_pct >= 0 and len(positivos) < 4:
                positivos.append(item)
            elif impacto_pct < 0 and len(negativos) < 4:
                negativos.append(item)

        return {"positivos": positivos, "negativos": negativos}

    @staticmethod
    def _traduzir(nome_tecnico: str) -> str:
        mapa = {
            "num__idade_matriz": "Idade da matriz",
            "num__paridade": "Paridade",
            "num__ecc": "ECC (condição corporal)",
            "num__historico_matriz": "Histórico da matriz",
            "num__taxa_reprodutor": "Histórico do reprodutor",
            "num__mes": "Mês do evento",
            "num__estacao_favoravel": "Estação favorável",
        }
        if nome_tecnico in mapa:
            return mapa[nome_tecnico]

        if nome_tecnico.startswith("cat__raca_matriz_"):
            return f"Raça matriz: {nome_tecnico.split('cat__raca_matriz_')[1]}"
        if nome_tecnico.startswith("cat__raca_reprodutor_"):
            return f"Raça reprodutor: {nome_tecnico.split('cat__raca_reprodutor_')[1]}"
        if nome_tecnico.startswith("cat__especie_"):
            return f"Espécie: {nome_tecnico.split('cat__especie_')[1]}"
        if nome_tecnico.startswith("cat__tecnica_"):
            return f"Técnica: {nome_tecnico.split('cat__tecnica_')[1]}"
        return nome_tecnico


def get_predictor() -> PrenhezPredictor:
    """Dependency injection para FastAPI."""
    return PrenhezPredictor()