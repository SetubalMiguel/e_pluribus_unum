# e pluribus unum — Backend (`apps/api`)

API FastAPI da plataforma **e pluribus unum — de muitos, um** (forma reduzida:
*pluribus unum*) — gestão genética e reprodutiva de bovinos, ovinos e caprinos,
com IA para predição de prenhez e recomendação de cruzamentos.

Stack: FastAPI · SQLAlchemy 2 · Pydantic v2 · Alembic · scikit-learn ·
PostgreSQL 16. Tudo containerizado via `docker-compose`.

## Rodando

A forma recomendada é via `docker-compose` na raiz do repo — sobe API + DB +
Adminer + Frontend em uma chamada:

```bash
docker compose up --build
# API:      http://localhost:8000   (docs em /docs)
# Adminer:  http://localhost:8080
# Web:      http://localhost:3000
```

Na primeira subida o container roda `alembic upgrade head` automaticamente.
Para popular o banco com o seed (1 produtor + 990 animais + 4 500
inseminações):

```bash
docker compose exec api python -m scripts.seed
```

Para treinar o modelo de IA a partir do dataset sintético:

```bash
docker compose exec api python -m ml.train
# artefatos: ml/models/prenhez_v1.joblib + ml/models/metricas_v1.json
```

### Rodando local sem Docker

Pré-requisitos: Python 3.11, PostgreSQL 16 acessível em `localhost:5432`.

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql+psycopg://unum:unum_dev@localhost:5432/unum"
alembic upgrade head
uvicorn app.main:app --reload
```

## Endpoints

Documentação interativa: **http://localhost:8000/docs** (Swagger) ou
`/redoc` (ReDoc).

| Método | Rota | Função |
|---|---|---|
| `GET` | `/health` | Healthcheck (`{status: "ok"}`) |
| `GET` | `/animals` | Lista paginada (filtros: `especie`, `sexo`, `busca`, `ativo`, `page`, `page_size`) |
| `GET` | `/animals/{id}` | Detalhes |
| `POST` | `/animals` | Cadastra (valida `dados_geneticos` por sexo via `model_validator`) |
| `PATCH` | `/animals/{id}` | Atualiza parcial |
| `PATCH` | `/animals/{id}/dados-geneticos` | Atualiza só o blob genético |
| `DELETE` | `/animals/{id}` | Soft delete (marca `ativo=false`) |
| `GET` | `/inseminations` | Lista (filtros: `matriz_id`, `especie`, `resultado`, `page`, `page_size`) |
| `GET` | `/inseminations/{id}` | Detalhes |
| `POST` | `/inseminations` | Registra; aceita `predicao_prenhez` + `predicao_features` opcionais para auditoria |
| `PATCH` | `/inseminations/{id}` | Atualiza diagnóstico (`resultado_diagnostico` + `data_diagnostico`) |
| `DELETE` | `/inseminations/{id}` | Remove |
| `POST` | `/predict` | IA: predição de prenhez (`matriz_id`, `reprodutor_id`, `tecnica`, `data_evento`) → probabilidade + top fatores |
| `POST` | `/recommend` | IA: top-N reprodutores para uma matriz (com filtro opcional de parentesco) |
| `GET` | `/stats` | Agregados para dashboard (totais consolidados + por espécie + taxa de prenhez) |

## Enums (valores serializados pela rede)

Os enums Python têm nomes em CAIXA ALTA, mas o `value` (o que vai pelo JSON) é:

```python
Especie:               "bovino" | "ovino" | "caprino"
Sexo:                  "M" | "F"
Tecnica:               "IATF" | "convencional" | "IA_repasse"
                       | "IA_cervical" | "IA_laparoscopica"
ResultadoDiagnostico:  "prenhe" | "vazia" | "aguardando"
StatusCiclo:           "ativo" | "concluido_sucesso" | "concluido_falha"
```

## IA — pipeline preditivo

```
ml/
├── data_synth.py       # gera dataset sintético calibrado por literatura BR
├── train.py            # treina Gradient Boosting + serializa joblib
├── data/               # CSVs gerados (eventos_consolidado.csv, etc)
└── models/             # artefatos versionados (prenhez_v1.joblib, metricas_v1.json)
```

- **Algoritmo:** `GradientBoostingClassifier` (scikit-learn) em pipeline com
  `OneHotEncoder` para variáveis categóricas.
- **Features:** idade da matriz, paridade, ECC, histórico de sucesso da
  matriz, taxa histórica do reprodutor, mês do evento, estação favorável,
  espécie, raça da matriz, raça do reprodutor, técnica.
- **Calibração:** taxas de prenhez por espécie/técnica seguem referências
  Embrapa, ABCZ e ASBIA.
- **Métrica de referência:** AUC ROC ≈ 0,80 (5-fold CV + hold-out 80/20).
- **Explicabilidade:** o serviço (`app/services/predictor.py`) devolve os
  top fatores positivos/negativos por evento, já traduzidos para PT-BR para
  o frontend mostrar sem mapeamento extra.
- **Estado:** modelo é **estático** (`.joblib` carregado no boot). Não há
  pipeline automático de retreino com inseminações novas — é roadmap pós-MVP.

## Estrutura

```
apps/api/
├── alembic.ini                     # config do Alembic
├── Dockerfile                      # base python:3.11-slim
├── requirements.txt
├── app/
│   ├── main.py                     # FastAPI + CORS + include_router
│   ├── core/
│   │   ├── config.py               # Settings (Pydantic) — DATABASE_URL, CORS, JWT
│   │   └── auth.py                 # placeholders de auth (sem login real ainda)
│   ├── db/
│   │   ├── base.py                 # Base declarativa + TimestampMixin + UUIDMixin
│   │   └── session.py              # engine + SessionLocal + get_db
│   ├── models/                     # ORM (ver apps/api/db/README.md)
│   │   ├── animal.py
│   │   ├── audit_log.py
│   │   ├── ciclo_reprodutivo.py
│   │   ├── enums.py
│   │   ├── inseminacao.py
│   │   ├── produtor.py
│   │   └── recomendacao_cruzamento.py
│   ├── schemas/                    # Pydantic v2 (request/response)
│   │   ├── animal.py               # com model_validator p/ dados_geneticos por sexo
│   │   ├── inseminacao.py
│   │   ├── predict.py
│   │   ├── recommend.py
│   │   └── stats.py
│   ├── routers/                    # rotas FastAPI
│   │   ├── animals.py
│   │   ├── inseminations.py
│   │   ├── predict.py
│   │   ├── recommend.py
│   │   └── stats.py
│   └── services/                   # regra de negócio + IA
│       ├── predictor.py            # carrega joblib + monta features + top fatores
│       └── recommender.py          # ranqueia reprodutores + filtro de parentesco
├── ml/                             # pipeline de dados + treino
├── migrations/                     # Alembic
├── db/                             # scripts de inicialização do Postgres (ver db/README.md)
└── scripts/
    └── seed.py                     # popula DB com produtor demo + animais + IAs
```

## Variáveis de ambiente

Todas têm default sensato em dev. Em prod, defina via `.env` ou orquestrador:

| Variável | Default | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://unum:unum_dev@db:5432/unum` | Conexão Postgres |
| `JWT_SECRET` | `dev_secret_change_in_production` | Segredo p/ JWT (auth ainda não habilitada) |
| `JWT_ALGORITHM` | `HS256` | Algoritmo do JWT |
| `JWT_EXPIRATION_MINUTES` | `15` | TTL do token |
| `CORS_ORIGINS` | `http://localhost:3000` | Lista CSV de origens permitidas |
| `ENVIRONMENT` | `development` | Marcador de ambiente |
| `LOG_LEVEL` | `info` | Verbosidade do uvicorn |

## Migrations

Criar nova migration a partir das mudanças nos models:

```bash
docker compose exec api alembic revision --autogenerate -m "descrição curta"
docker compose exec api alembic upgrade head
```

Reverter:

```bash
docker compose exec api alembic downgrade -1
```

Detalhes do esquema, ENUMs nativos do Postgres, JSONB e estratégia de
auditoria estão documentados em **[`db/README.md`](db/README.md)**.

## Testes e qualidade

```bash
docker compose exec api pytest                  # roda a suíte
docker compose exec api ruff check app          # lint
docker compose exec api ruff format --check app # formatação
```

## Dependências (resumo)

Todas compatíveis com GPLv3 (MIT/BSD/Apache-2.0/PSF):

| Pacote | Uso |
|---|---|
| `fastapi`, `uvicorn[standard]` | Framework + ASGI server |
| `pydantic`, `pydantic-settings` | Validação + config |
| `sqlalchemy`, `alembic`, `psycopg[binary]` | ORM + migrations + driver Postgres |
| `python-jose`, `passlib`, `bcrypt` | JWT + hash de senha (auth pendente) |
| `scikit-learn`, `pandas`, `numpy`, `joblib`, `shap` | IA + explicabilidade |
| `pytest`, `pytest-asyncio`, `ruff` | Qualidade |

## Status

✅ MVP completo para o desafio do edital. Pendências conhecidas
(autenticação real, exportação CSV/PDF, pipeline de retreino) estão no
roadmap pós-hackathon e listadas no README raiz.
