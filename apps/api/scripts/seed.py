"""
Popular o banco com dados sintéticos para demo do MVP.

Uso (dentro do container):
    docker compose exec api python -m scripts.seed

Comportamento:
- Cria 1 produtor demo (demo@unum.test / senha 'demo123').
- Limpa todos os dados desse produtor (idempotente).
- Importa matrizes, reprodutores, ciclos reprodutivos e eventos dos CSVs em
  ml/data/ (gerados pelo módulo ml.data_synth, calibrados por literatura
  zootécnica BR).
- Resultado: ~1.620 animais (matrizes + reprodutores), ~6.000 ciclos e ~9.600
  inseminações.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

import pandas as pd
from passlib.context import CryptContext
from sqlalchemy import delete, select

from app.db.session import SessionLocal
from app.models import (
    Animal,
    CicloReprodutivo,
    Especie,
    Inseminacao,
    Produtor,
    ResultadoDiagnostico,
    Sexo,
    StatusCiclo,
    Tecnica,
)
from ml.data_synth import gerar_dataset_completo

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DATA_DIR = Path("ml/data")
DEMO_EMAIL = "demo@unum.test"
DEMO_SENHA = "demo123"

# Mapeamento string -> enum
ESPECIE_MAP = {
    "bovino": Especie.BOVINO,
    "ovino": Especie.OVINO,
    "caprino": Especie.CAPRINO,
}
TECNICA_MAP = {
    "IATF": Tecnica.IATF,
    "convencional": Tecnica.CONVENCIONAL,
    "IA_repasse": Tecnica.IA_REPASSE,
    "IA_cervical": Tecnica.IA_CERVICAL,
    "IA_laparoscopica": Tecnica.IA_LAPAROSCOPICA,
}
RESULTADO_MAP = {
    "prenhe": ResultadoDiagnostico.PRENHE,
    "vazia": ResultadoDiagnostico.VAZIA,
    "aguardando": ResultadoDiagnostico.AGUARDANDO,
}
STATUS_CICLO_MAP = {
    "ativo": StatusCiclo.ATIVO,
    "concluido_sucesso": StatusCiclo.CONCLUIDO_SUCESSO,
    "concluido_falha": StatusCiclo.CONCLUIDO_FALHA,
}


def garantir_dados_csv() -> None:
    """Gera os CSVs se ainda não existirem."""
    consolidado = DATA_DIR / "eventos_consolidado.csv"
    if not consolidado.exists():
        print("CSVs não encontrados — gerando dataset sintético...")
        gerar_dataset_completo(output_dir=DATA_DIR)
    else:
        print(f"Usando CSVs existentes em {DATA_DIR}/")


def obter_ou_criar_produtor_demo(session) -> Produtor:
    """Cria o produtor demo se não existir."""
    produtor = session.execute(
        select(Produtor).where(Produtor.email == DEMO_EMAIL)
    ).scalar_one_or_none()

    if produtor:
        print(f"Produtor demo já existe: {produtor.email}")
        return produtor

    produtor = Produtor(
        nome="Produtor Demo",
        email=DEMO_EMAIL,
        senha_hash=pwd_context.hash(DEMO_SENHA),
        telefone="(88) 99999-0000",
        propriedade="Fazenda Boa Vista (Demo)",
        municipio="Crateús",
        uf="CE",
    )
    session.add(produtor)
    session.flush()
    print(f"Produtor demo criado: {produtor.email}")
    return produtor


def limpar_dados_do_produtor(session, produtor_id: UUID) -> None:
    """Remove todas as inseminações e animais do produtor demo (cascata cuida do resto)."""
    n_animais = session.execute(
        select(Animal).where(Animal.produtor_id == produtor_id)
    ).scalars().all()
    n_animais = len(n_animais)

    if n_animais == 0:
        print("Nenhum animal pré-existente do produtor demo — nada a limpar.")
        return

    # cascade="all, delete-orphan" no Animal cuida das inseminações e ciclos
    session.execute(delete(Animal).where(Animal.produtor_id == produtor_id))
    session.flush()
    print(f"Limpou {n_animais} animais pré-existentes (e dependências em cascata).")


def importar_animais(session, produtor: Produtor) -> dict[str, UUID]:
    """
    Importa matrizes (fêmeas) e reprodutores (machos) para o banco.
    Retorna um dicionário externo_id -> uuid_no_banco.
    """
    mapa_ids: dict[str, UUID] = {}
    total = 0

    for especie_str, especie_enum in ESPECIE_MAP.items():
        # Matrizes (fêmeas)
        df_matrizes = pd.read_csv(DATA_DIR / f"matrizes_{especie_str}.csv")
        for _, row in df_matrizes.iterrows():
            animal_id = uuid4()
            session.add(Animal(
                id=animal_id,
                produtor_id=produtor.id,
                especie=especie_enum,
                identificacao=row["matriz_id"],
                sexo=Sexo.FEMEA,
                raca=row["raca"],
                dados_geneticos={
                    "ecc": float(row["ecc"]),
                    "paridade": int(row["paridade"]),
                    "idade_anos": float(row["idade"]),
                    "historico_sucesso": float(row["historico_sucesso"]),
                },
            ))
            mapa_ids[row["matriz_id"]] = animal_id
            total += 1

        # Reprodutores (machos)
        df_reprodutores = pd.read_csv(DATA_DIR / f"reprodutores_{especie_str}.csv")
        for _, row in df_reprodutores.iterrows():
            animal_id = uuid4()
            session.add(Animal(
                id=animal_id,
                produtor_id=produtor.id,
                especie=especie_enum,
                identificacao=row["reprodutor_id"],
                sexo=Sexo.MACHO,
                raca=row["raca"],
                dados_geneticos={
                    "idade_anos": float(row["idade"]),
                    "taxa_sucesso_historica": float(row["taxa_sucesso_historica"]),
                },
            ))
            mapa_ids[row["reprodutor_id"]] = animal_id
            total += 1

        session.flush()
        print(f"  {especie_str}: importou {len(df_matrizes)} matrizes + {len(df_reprodutores)} reprodutores")

    print(f"Total de animais importados: {total}")
    return mapa_ids


def importar_ciclos(session, mapa_ids: dict[str, UUID]) -> int:
    """Importa ciclos reprodutivos do CSV consolidado."""
    path = DATA_DIR / "ciclos_consolidado.csv"
    if not path.exists():
        print("Arquivo ciclos_consolidado.csv não encontrado — pulando ciclos.")
        return 0

    df = pd.read_csv(path)
    total = 0
    lote: list[CicloReprodutivo] = []
    LOTE_SIZE = 500

    for _, row in df.iterrows():
        matriz_uuid = mapa_ids.get(row["matriz_id"])
        if matriz_uuid is None:
            continue

        data_inicio = datetime.fromisoformat(row["data_inicio"]).date()
        data_fim = (
            datetime.fromisoformat(row["data_fim"]).date()
            if pd.notna(row["data_fim"])
            else None
        )
        parto_data = (
            datetime.fromisoformat(row["parto_data"]).date()
            if pd.notna(row["parto_data"])
            else None
        )

        lote.append(CicloReprodutivo(
            matriz_id=matriz_uuid,
            data_inicio=data_inicio,
            data_fim=data_fim,
            status=STATUS_CICLO_MAP[row["status"]],
            parto_data=parto_data,
            # cria_id fica None — o dataset sintético não cadastra as crias
            # como animais (seria uma cascata muito maior). O usuário pode
            # vincular crias manualmente pela UI quando registrar a cria.
            cria_id=None,
        ))
        total += 1

        if len(lote) >= LOTE_SIZE:
            session.add_all(lote)
            session.flush()
            lote = []

    if lote:
        session.add_all(lote)
        session.flush()

    print(f"Importou {total} ciclos reprodutivos.")
    return total


def importar_inseminacoes(session, mapa_ids: dict[str, UUID]) -> int:
    """Importa eventos de inseminação do CSV consolidado."""
    df = pd.read_csv(DATA_DIR / "eventos_consolidado.csv")
    total = 0
    lote = []
    LOTE_SIZE = 500

    for _, row in df.iterrows():
        matriz_uuid = mapa_ids.get(row["matriz_id"])
        reprodutor_uuid = mapa_ids.get(row["reprodutor_id"])
        if matriz_uuid is None:
            continue  # matriz não importada por algum motivo

        data_evento = datetime.fromisoformat(row["data_evento"]).replace(tzinfo=timezone.utc)

        lote.append(Inseminacao(
            matriz_id=matriz_uuid,
            reprodutor_id=reprodutor_uuid,
            data_evento=data_evento,
            tecnica=TECNICA_MAP[row["tecnica"]],
            resultado_diagnostico=RESULTADO_MAP[row["resultado"]],
            data_diagnostico=data_evento.date(),
            observacoes="Evento sintético gerado para demonstração",
        ))
        total += 1

        if len(lote) >= LOTE_SIZE:
            session.add_all(lote)
            session.flush()
            lote = []

    if lote:
        session.add_all(lote)
        session.flush()

    print(f"Importou {total} inseminações.")
    return total


def main() -> int:
    print("=" * 60)
    print("Unum — populador de dados sintéticos")
    print("=" * 60)

    garantir_dados_csv()

    with SessionLocal() as session:
        try:
            produtor = obter_ou_criar_produtor_demo(session)
            limpar_dados_do_produtor(session, produtor.id)
            mapa_ids = importar_animais(session, produtor)
            importar_ciclos(session, mapa_ids)
            importar_inseminacoes(session, mapa_ids)
            session.commit()
        except Exception as exc:
            session.rollback()
            print(f"ERRO: {exc}", file=sys.stderr)
            raise

    print("\n" + "=" * 60)
    print("Concluído!")
    print(f"Produtor demo: {DEMO_EMAIL} / senha: {DEMO_SENHA}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())