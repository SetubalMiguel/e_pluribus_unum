# Projeto: e pluribus unum — de muitos, um — Hackathon Expoagro Crateús 2026

## Contexto

Plataforma web responsiva (mobile-first) para gestão genética e reprodutiva
de bovinos, ovinos e caprinos, com IA para predição de prenhez e
recomendação de cruzamentos.

**Submissão:** Hackathon Expoagro Crateús — Edital nº 01/2026
**Prazo etapa 1:** 22/05/2026 (vídeo pitch + protótipo funcional)
**Prazo etapa 2:** 05/06/2026 (solução implementada)
**Licença obrigatória:** GNU GPL v3.0

## Estado atual

### Backend (✅ completo)

API FastAPI rodando em http://localhost:8000
Documentação interativa: http://localhost:8000/docs

**Endpoints disponíveis:**
- `GET    /animals` — lista paginada com filtros (especie, sexo, busca, ativo, page, page_size)
- `GET    /animals/{id}` — detalhes
- `POST   /animals` — cadastra
- `PATCH  /animals/{id}` — atualiza parcial
- `DELETE /animals/{id}` — soft delete (marca ativo=false)
- `GET    /inseminations` — lista (filtros: matriz_id, especie, resultado, page, page_size)
- `GET    /inseminations/{id}` — detalhes
- `POST   /inseminations` — registra (aceita predição opcional para auditoria)
- `PATCH  /inseminations/{id}` — atualiza diagnóstico
- `DELETE /inseminations/{id}` — remove
- `POST   /predict` — IA: predição de prenhez (entrada: matriz_id, reprodutor_id, tecnica, data_evento)
- `POST   /recommend` — IA: top-N reprodutores para uma matriz
- `GET    /stats` — agregados para dashboard
- `GET    /health` — healthcheck

**Modelo de dados (enums — valores serializados):**
- Especie: `bovino`, `ovino`, `caprino`
- Sexo: `M`, `F`
- Tecnica: `IATF`, `convencional`, `IA_repasse`, `IA_cervical`, `IA_laparoscopica`
- ResultadoDiagnostico: `prenhe`, `vazia`, `aguardando`

**Autenticação:** Por enquanto, todas as requisições assumem o produtor demo. Sem login. CORS aberto para http://localhost:3000.

### Dados de seed

- 1 produtor demo
- 990 animais (300 matrizes + 30 reprodutores por espécie)
- 4500 inseminações com resultados já preenchidos
- Modelo de IA treinado com AUC ROC ~0.80

### Frontend (✅ MVP funcional)

Em `apps/web/`, Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui.
Mobile-first, instalável como PWA.

```bash
cd apps/web
npm install
npm run dev   # http://localhost:3000
```

API_URL configurável via `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

**Telas implementadas:**
- `/` — dashboard com `/stats` consolidado + por espécie e atalhos rápidos
  (empty-state com CTA "Cadastrar primeiro animal" quando ainda não há dados)
- `/animais` — listagem com chips de espécie/sexo com contagens, busca
  debounced, paginação 20 (mobile) / 50 (desktop), status da última IA por
  matriz
- `/animais/novo` — wizard 3 passos no mobile (Básico → Genético →
  Confirmação), 2 colunas no desktop; validação `react-hook-form` + `zod`;
  raça filtrada por espécie; ECC com slider
- `/animais/[id]` — ficha completa: identificação, dados genéticos
  formatados, histórico de inseminações, CTA contextual por sexo
- `/inseminacoes` — histórico com filtros por resultado e espécie
- `/inseminacoes/nova` — wizard com **predição automática da IA** ao
  preencher os 4 campos chave (debounce 400 ms), barra de probabilidade,
  top 4 fatores positivos/negativos, modal "🤖 Recomendar com IA"
- `/ciclos` — lista global de ciclos reprodutivos com chips de status
  (ativos/sucesso/falha) e espécie. CRUD completo via `<CicloDialog>`
  (criar, fechar com parto, vincular cria, remover)
- `/recomendacoes` — escolha de matriz em **lista estilo /animais** (chips de
  espécie com contagem + busca + cards clicáveis + paginação), depois top 5
  reprodutores ranqueados com fatores positivos e CTA "Selecionar e registrar
  inseminação" que pré-preenche o wizard
- `/not-found.tsx` — 404 customizado

**Ajustes recentes (refinos de UX/UI):**
- Diálogo de atualização de diagnóstico em `/animais/[id]` e `/inseminacoes`
  (botão "Confirmar resultado" para aguardando, "Editar resultado" para o resto)
- Wizards (`/animais/novo` e `/inseminacoes/nova`) com **guard de etapa** —
  submit do form é no-op puro; save só via click explícito no botão "Salvar"
  no step final. Elimina disparos fantasma por Enter/"Go" do teclado mobile
- Cards de animal (`/animais` em mobile/tablet) clicáveis no card inteiro,
  com ícone de olho no canto inferior direito
- **Tooltips informativos** (`<InfoHint>`) ao lado de siglas técnicas:
  cabeçalhos ECC, Última IA, Predição IA + glossário de cada técnica
  (IATF, IA_cervical, IA_laparoscopica, IA_repasse, convencional)
- `<MatrizPicker>` (componente novo): substitui o autocomplete dropdown na
  tela de recomendações pelo mesmo estilo de lista de `/animais`
- Navbar com logo maior (`h-16 sm:h-20`) e altura ajustada (`h-20 lg:h-24`)
- PNG icons regenerados a partir de `icon.png` provido pelo usuário

**Diferenciais já entregues:**
- IA com explicabilidade (fatores +/- em todo lugar onde aparece probabilidade)
- Recomendação com filtro de parentesco
- Mobile-first real (tabelas viram cards, FABs, bottom nav, touch targets ≥ 44px)
- PWA com manifest + ícones 192/512 PNG + ícone principal (`icon.png` 940×972)
- Toaster global (`sonner`) para feedback de submits e ações de IA
- Tooltips contextuais (Radix Tooltip) explicando siglas zootécnicas em PT-BR

**Documentação detalhada:**
- `apps/web/README.md` — como rodar, deps, decisões de design
- `apps/web/STATUS.md` — checklist do que está pronto + limitações + roadmap
  pós-hackathon

## Auto-avaliação contra o Edital N.º 01/2026

### Funcionalidades obrigatórias (seção 2 do edital)

| Requisito do edital | Onde está | Status |
|---|---|---|
| Cadastro/gestão de animais com dados genéticos por espécie, raça, linhagem, histórico reprodutivo | `POST/GET/PATCH/DELETE /animals` + telas `/animais*` | ✅ |
| Registro e acompanhamento de ciclos reprodutivos e IA por espécie | `/inseminations` + telas `/inseminacoes*` + diálogo de diagnóstico | ✅ |
| Análise preditiva com IA para taxa de prenhez | `POST /predict` (Gradient Boosting, AUC ≈ 0,80) + painel ao vivo no wizard | ✅ |
| Relatórios de desempenho genético/reprodutivo por espécie e consolidado | `GET /stats` + dashboard com card consolidado + 3 cards por espécie | ✅ (em tela; export pendente) |
| Recomendações IA para matrizes e reprodutores | `POST /recommend` + `/recomendacoes` (top 5 + fatores + filtro de parentesco) | ✅ |
| Interface acessível, inclusive mobile | Next.js mobile-first + PWA + touch targets ≥ 44px + bottom nav + cards adaptativos | ✅ |
| Armazenamento seguro c/ exportação/integração | Postgres + Pydantic; **export CSV/PDF e integração externa não implementados** | ⚠️ parcial |
| GNU GPL v3.0 | `package.json` declara `GPL-3.0-or-later`; auditoria das 456 deps confirma compatibilidade (zero AGPL/SSPL/BUSL/EPL/CDDL/Commons Clause) | ✅ |

> O edital exige **ao menos uma** das três abordagens de IA — entregamos as **três**: predição, identificação de padrões (top fatores por feature) e recomendação automatizada.

### Critérios da 2ª etapa (autoavaliação)

| Critério (peso) | Como o MVP responde | Risco |
|---|---|---|
| **Originalidade e Inovação (20%)** | IA explicável (top fatores PT-BR), recomendação c/ filtro de parentesco, predição embutida em tempo real no formulário, tooltips contextuais | baixo |
| **Relevância e Impacto p/ produtor rural (20%)** | 3 espécies do sertão (bovino/ovino/caprino), wizard mobile p/ uso em campo, modelo calibrado por literatura zootécnica BR (Embrapa, ABCZ, ASBIA) | baixo |
| **Execução e Funcionalidade (20%)** | Fluxos golden-path completos (cadastro → IA → registro → diagnóstico → recomendação), 990 animais + 4.500 inseminações de seed | baixo |
| **Viabilidade Técnica (20%)** | FastAPI + Postgres + Next.js — stack mainstream, deployável em VPS; modelo `.joblib` < 1 MB | baixo |
| **Escalabilidade e Sustentabilidade (10%)** | API paginada, índices, modelo retreinável; **falta pipeline automático de retreino** | médio |
| **Segurança e Privacidade — LGPD (10%)** | Sem dados pessoais sensíveis (sistema zootécnico); **falta auth/RBAC e política formal de retenção** | médio |

### Gaps conscientes (roadmap etapa 2)

1. **Exportação/integração** (CSV, relatório PDF, rastreabilidade) — citado no edital, não implementado.
2. **Autenticação + multi-produtor** — hoje assume produtor demo único; CORS aberto.
3. **Pipeline de retreino** — modelo é estático (`.joblib`); o sistema não aprende sozinho com novas inseminações registradas.
4. **Anexos II/III/IV/V (termos)** — assinatura presencial; pendência administrativa, não técnica.

### Checklist da submissão 1ª etapa (deadline 22/05/2026)

- [x] Protótipo funcional (frontend + backend + IA rodando)
- [x] Licença GPL-3.0 declarada e auditada
- [ ] Vídeo pitch de até 5 min demonstrando o protótipo (item 3.2 do edital)
- [ ] Ficha de inscrição via `forms.gle/DF7hRrvoranHD56V6`

## Decisões de arquitetura (NÃO revisitar sem motivo forte)

- **NÃO é app nativo.** É site responsivo mobile-first instalável como PWA
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- **Storage local:** Dexie.js (IndexedDB) para cache offline (opcional na etapa 1)
- **Sem login real ainda** — usar fetch direto, sem token
- **Deploy:** Vercel (free)
- **Sem React Native, sem Flutter, sem Expo**

## Diretrizes de UI (não negociáveis)

- **Mobile-first SEMPRE.** Tudo começa estilizado para < 640px; `md:` e `lg:` adicionam complexidade
- Touch targets de no mínimo 44px em mobile
- Tabelas viram **cards empilhados** em mobile, NUNCA scroll horizontal
- Formulários: 1 campo por linha no celular, 2-3 colunas no notebook
- Botões de ação primária ficam **fixos no rodapé** em mobile, inline em desktop
- Navegação: bottom tab bar no celular, sidebar no desktop — mesmo conteúdo, posição diferente
- Cores semânticas: verde para sucesso/prenhe, amarelo para aguardando, vermelho para vazia/erro
- Ícones grandes; alto contraste; acessibilidade real
- Comentários e textos da UI em **português brasileiro**
- Código (variáveis, funções, componentes) em **inglês**

## Diferenciais a destacar

1. Suporte às 3 espécies (bovinos, ovinos, caprinos) com gestão integrada
2. IA com explicabilidade (mostra fatores que influenciam a predição)
3. Recomendação de cruzamento com filtro de parentesco
4. Mobile-first real, não "responsivo escondendo coisas"
5. Acessibilidade para produtor rural (input por voz onde fizer sentido)

## Restrições técnicas

- Toda dependência adicionada deve ser GPL v3.0 compatível (MIT, BSD, Apache 2.0, LGPD OK; SSPL/BUSL/Commons Clause NÃO)
- NÃO usar localStorage/sessionStorage (apenas useState/useReducer/Dexie)
- NÃO usar APIs pagas (OpenAI, Anthropic, etc) no caminho crítico
- API_URL deve ser configurável via variável de ambiente NEXT_PUBLIC_API_URL (default: http://localhost:8000)

## Estrutura de apps/web/

```
apps/web/
├── public/
│   ├── icon.png                    # ícone mestre (940×972)
│   ├── icon-192.png                # PWA
│   ├── icon-512.png
│   ├── logo.png                    # wordmark (3100×1344)
│   └── manifest.json
├── src/
│   ├── app/
│   │   ├── animais/
│   │   │   ├── [id]/page.tsx       # detalhe + histórico de IA + seção de ciclos + diálogos
│   │   │   ├── novo/page.tsx       # wizard de cadastro c/ guard de etapa
│   │   │   └── page.tsx            # listagem (chips + tabela/cards) c/ tooltips em ECC, Última IA
│   │   ├── ciclos/page.tsx         # lista de ciclos reprodutivos + CRUD via dialog
│   │   ├── inseminacoes/
│   │   │   ├── nova/page.tsx       # wizard + predição automática + modal recommend
│   │   │   └── page.tsx            # histórico c/ tooltips em Predição IA e técnica
│   │   ├── recomendacoes/page.tsx  # MatrizPicker → top 5 reprodutores
│   │   ├── globals.css
│   │   ├── layout.tsx              # AppShell + Toaster
│   │   ├── not-found.tsx           # 404 customizado
│   │   └── page.tsx                # dashboard
│   ├── components/
│   │   ├── ui/                     # shadcn (button, card, dialog, tooltip, …)
│   │   ├── animal-search-input.tsx # autocomplete (usado em /inseminacoes/nova)
│   │   ├── app-shell.tsx           # header + sidebar + bottom-tab (5 cols agora)
│   │   ├── ciclo-dialog.tsx        # dialog de criar/editar ciclo reprodutivo
│   │   ├── info-hint.tsx           # ícone "i" + tooltip Radix p/ siglas
│   │   ├── matriz-picker.tsx       # lista estilo /animais p/ escolha de matriz
│   │   ├── nav-items.ts            # 5 itens (inclui /ciclos)
│   │   └── update-diagnostico-dialog.tsx
│   ├── hooks/
│   │   ├── use-debounce.ts
│   │   └── use-media-query.ts
│   └── lib/
│       ├── api.ts                  # apiFetch<T> tipado + helpers por endpoint
│       ├── types.ts                # tipos espelhando o backend
│       └── utils.ts
├── next.config.mjs                 # reactStrictMode + NEXT_PUBLIC_API_URL
├── tailwind.config.ts              # tokens shadcn + primary verde-700 #15803d
└── tsconfig.json                   # strict + alias "@/*"
```

**Stack:** Next.js 14.2 · React 18 · TypeScript 5 · Tailwind 3 · shadcn/ui
(neutral, light only) · lucide-react · react-hook-form + zod · sonner ·
Radix UI primitives (Dialog, Select, RadioGroup, Slider, Label, **Tooltip**).
Todas as deps MIT/Apache-2.0/ISC — GPLv3-compatíveis.

