# e pluribus unum — Banco de Dados

Modelo de dados da plataforma **e pluribus unum**. PostgreSQL 16, schema
versionado via Alembic (`apps/api/migrations/`), tipos enum nativos do
Postgres e JSONB para campos genéticos flexíveis por espécie.

## Como subir

Via `docker-compose` na raiz do repo:

```bash
docker compose up -d db adminer
# Postgres em localhost:5432 (db / unum / unum_dev_password)
# Adminer  em http://localhost:8080 (server: db, user: unum, db: unum)
```

A imagem é `postgres:16-alpine`. O volume `db_data` persiste os dados entre
restarts.

Init scripts colocados em `apps/api/db/init/` são executados **uma única
vez** na criação do volume (entrypoint padrão do Postgres). Atualmente o
diretório está vazio — toda a criação de schema é feita via Alembic ao
subir a API.

## Conexão

| Variável | Valor padrão (dev) |
|---|---|
| Host | `db` (dentro da rede compose) / `localhost` (fora) |
| Porta | `5432` |
| Usuário | `unum` |
| Senha | `unum_dev_password` |
| Database | `unum` |
| URL completa | `postgresql+psycopg://unum:unum_dev_password@db:5432/unum` |

> Em produção, **troque a senha** via `.env` (`POSTGRES_PASSWORD`) e
> regenere `JWT_SECRET` com `openssl rand -hex 32`.

## Tabelas

Os ORMs vivem em `apps/api/app/models/`. Todos os PKs são `uuid` gerados na
app (`uuid4()`), todos os timestamps são `timestamptz` com defaults
server-side.

### `produtor`
Dono do rebanho. Hoje há apenas um produtor demo (sistema é
single-tenant); multi-produtor é roadmap.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `nome` | `varchar(160)` | obrigatório |
| `email` | `varchar(200)` | único, indexado |
| `senha_hash` | `varchar(255)` | bcrypt (auth pendente) |
| `telefone`, `cpf`, `propriedade`, `municipio`, `uf` | varchar | opcionais |
| `created_at`, `updated_at` | `timestamptz` | |

### `animal`
Registro genético-reprodutivo comum às 3 espécies. Constraint
única `(produtor_id, identificacao)` para garantir IDs únicos por rebanho.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `produtor_id` | `uuid` FK→produtor | `ON DELETE CASCADE`, indexado |
| `especie` | `especie_enum` | `bovino` / `ovino` / `caprino`, indexado |
| `identificacao` | `varchar(50)` | brinco / nome / código do produtor |
| `sexo` | `sexo_enum` | `M` / `F` |
| `data_nascimento` | `date` | opcional |
| `raca`, `linhagem`, `origem` | varchar | opcionais |
| `dados_geneticos` | `jsonb` | shape varia por sexo (ver abaixo) |
| `ativo` | `bool` | soft delete |
| `created_at`, `updated_at` | `timestamptz` | |

**Shape do `dados_geneticos`:**

```jsonc
// Fêmea (matriz)
{
  "idade_anos": 3.5,
  "ecc": 3.2,                     // 1.0–5.0
  "paridade": 2,                  // 0–15
  "historico_sucesso": 0.65       // 0.0–1.0, opcional
}

// Macho (reprodutor)
{
  "idade_anos": 4.0,
  "taxa_sucesso_historica": 0.72  // 0.0–1.0, opcional
}
```

> A validação de forma por sexo acontece no `model_validator` do schema
> Pydantic (`apps/api/app/schemas/animal.py`), não no banco. JSONB no
> Postgres aceita qualquer forma — a integridade vem da app.

### `inseminacao`
Cada evento reprodutivo. Guarda a predição da IA no momento do registro,
para auditoria mesmo se o modelo for retreinado.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `matriz_id` | `uuid` FK→animal | `ON DELETE CASCADE`, indexado |
| `reprodutor_id` | `uuid` FK→animal | `ON DELETE SET NULL`, indexado, nullable (sêmen externo) |
| `semen_externo` | `jsonb` | central/origem quando não há reprodutor local |
| `data_evento` | `timestamptz` | indexado |
| `tecnica` | `tecnica_enum` | `IATF`, `convencional`, `IA_repasse`, `IA_cervical`, `IA_laparoscopica` |
| `inseminador` | `varchar(160)` | nome do técnico |
| `observacoes` | `text` | |
| `resultado_diagnostico` | `resultado_diagnostico_enum` | default `aguardando` |
| `data_diagnostico` | `date` | preenchido na confirmação |
| `predicao_prenhez` | `numeric(4,3)` | 0.000–1.000 — snapshot da IA |
| `predicao_features` | `jsonb` | top fatores PT-BR |
| `modelo_versao` | `varchar(20)` | ex.: `prenhez_v1` |

### `ciclo_reprodutivo`
Agrupa eventos da matriz do cio até o parto (ou falha). Usado para
relatórios consolidados; ainda não exposto na UI.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `matriz_id` | `uuid` FK→animal | indexado |
| `data_inicio`, `data_fim` | `date` | |
| `status` | `status_ciclo_enum` | `ativo` / `concluido_sucesso` / `concluido_falha` |
| `parto_data` | `date` | |
| `cria_id` | `uuid` FK→animal | `ON DELETE SET NULL` |

### `recomendacao_cruzamento`
Snapshot das recomendações geradas pelo `/recommend`, com justificativa
SHAP. Permite explicar a decisão da IA depois.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `matriz_id`, `reprodutor_id` | `uuid` FK→animal | `ON DELETE CASCADE` |
| `score` | `numeric(4,3)` | 0.000–1.000 |
| `justificativa` | `jsonb` | `{feature_name: contribuição}` |
| `modelo_versao` | `varchar(20)` | |
| `gerada_em` | `timestamptz` | default `now()` |

### `audit_log`
Log de ações para conformidade LGPD. Estrutura genérica que aceita
qualquer ação sobre qualquer entidade.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `usuario_id` | `uuid` | quem fez (nullable enquanto auth não está plugada) |
| `acao` | `varchar(60)` | ex.: `create_animal`, `update_diagnostico` |
| `entidade` | `varchar(60)` | nome da tabela |
| `entidade_id` | `uuid` | id do registro afetado |
| `payload` | `jsonb` | diff / contexto |
| `ip` | `inet` | endereço de origem |
| `ts` | `timestamptz` | default `now()`, indexado |

## Enums nativos do Postgres

Criados como tipos de primeira classe (não strings com check constraint).
Os valores serializados pela API são lowercase para `especie` e single-letter
para `sexo` — bate com o que o frontend espera.

| Tipo Postgres | Valores |
|---|---|
| `especie_enum` | `bovino`, `ovino`, `caprino` |
| `sexo_enum` | `M`, `F` |
| `tecnica_enum` | `IATF`, `convencional`, `IA_repasse`, `IA_cervical`, `IA_laparoscopica` |
| `resultado_diagnostico_enum` | `prenhe`, `vazia`, `aguardando` |
| `status_ciclo_enum` | `ativo`, `concluido_sucesso`, `concluido_falha` |

Para adicionar um valor novo a um enum (ex.: nova técnica), use uma
migration com `ALTER TYPE ... ADD VALUE`:

```sql
ALTER TYPE tecnica_enum ADD VALUE 'IA_transcervical';
```

## Relacionamentos (diagrama textual)

```
produtor (1) ─── (N) animal
                       │
                       │ ──── (N) inseminacao   [matriz_id]
                       │ ──── (N) inseminacao   [reprodutor_id, nullable]
                       │
                       │ ──── (N) ciclo_reprodutivo [matriz_id]
                       │                            └── cria_id → animal
                       │
                       │ ──── (N) recomendacao_cruzamento [matriz_id, reprodutor_id]

audit_log    [independente, indexado por usuario_id, entidade, ts]
```

## Convenções

- **PKs** sempre `uuid` gerados na aplicação (`uuid4()` no Python). Evita
  round-trip para `gen_random_uuid()` e facilita testes.
- **Timestamps** `timestamptz` com defaults server-side (`server_default=now()`)
  e `onupdate=now()` para `updated_at` via SQLAlchemy.
- **Soft delete** apenas onde faz sentido reverter (animal). Eventos
  (`inseminacao`) usam hard delete.
- **`dados_geneticos` em JSONB**: aceita evolução do shape por espécie sem
  migration. A validação de forma é responsabilidade dos schemas Pydantic.
- **`audit_log`** desacoplado: aceita qualquer ação/entidade via JSONB —
  prepara terreno para multi-produtor + RBAC sem nova migration.

## Migrations (Alembic)

Os arquivos vivem em `apps/api/migrations/versions/`. Migration inicial:
`919a7b719305_initial_schema.py`.

### Comandos

```bash
# Aplicar todas as pendentes (rodado automaticamente no start da API)
docker compose exec api alembic upgrade head

# Criar nova a partir das mudanças nos models
docker compose exec api alembic revision --autogenerate -m "add foo"

# Reverter última
docker compose exec api alembic downgrade -1

# Histórico
docker compose exec api alembic history --verbose
```

> Sempre revise o autogenerate antes de comitar — Alembic não detecta
> renomes, mudanças em constraints com nome implícito, ou alterações em
> enums (essas precisam de SQL manual).

## Seed

Popula o banco com dados realistas para demonstração:

```bash
docker compose exec api python -m scripts.seed
```

Gera:

- 1 produtor demo
- 990 animais (≈330 por espécie, distribuição 90% matrizes / 10% reprodutores)
- 4 500 inseminações com resultados já preenchidos
- Datas e raças seguindo padrões da região (sertão cearense)

Idempotente — pode ser rodado mais de uma vez sem duplicar.

## Inspeção via Adminer

Acesse **http://localhost:8080**:

- System: PostgreSQL
- Server: `db`
- Username: `unum`
- Password: `unum_dev_password`
- Database: `unum`

Tema *dracula* já configurado.

## Backup / restore

Backup do banco do container para um arquivo local:

```bash
docker compose exec -T db pg_dump -U unum unum > backup_$(date +%Y%m%d).sql
```

Restore:

```bash
docker compose exec -T db psql -U unum -d unum < backup_20260522.sql
```

## Limites conhecidos

- **Sem RLS (Row Level Security)** — quando multi-produtor entrar, vai
  precisar de policies por `produtor_id` em todas as tabelas filhas.
- **Sem particionamento** de `inseminacao` — para 4 500 registros é
  desnecessário; em escala (>10M) considerar particionar por `data_evento`.
- **`audit_log` sem rotação** — em prod, definir TTL e arquivamento.
