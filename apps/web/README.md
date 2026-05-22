# e pluribus unum — Frontend (`apps/web`)

Frontend Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui da
plataforma **e pluribus unum — de muitos, um** (forma reduzida: *pluribus
unum*) — gestão genética e reprodutiva de bovinos, ovinos e caprinos, com IA
para predição de prenhez e recomendação de cruzamentos.

Mobile-first instalável como PWA. Consome a API FastAPI em `apps/api`.

## Rodando localmente

Pré-requisitos:

- Node.js 20+ (testado em 22.12)
- API rodando em `http://localhost:8000` (ver `apps/api/README.md`)

```bash
cd apps/web
npm install
npm run dev
# abre em http://localhost:3000
```

A URL da API é lida de `NEXT_PUBLIC_API_URL` (padrão `http://localhost:8000`).
Para apontar para outro endpoint:

```bash
cp .env.local.example .env.local
# edite .env.local conforme necessário
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com HMR |
| `npm run build` | Build de produção |
| `npm run start` | Roda o build de produção |
| `npm run lint` | ESLint (config do Next) |
| `npx tsc --noEmit` | Type-check sem emitir arquivos |

## Estrutura

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
│   │   │   ├── [id]/page.tsx       # detalhe + histórico + diálogo de diagnóstico
│   │   │   ├── novo/page.tsx       # wizard de cadastro c/ guard de etapa
│   │   │   └── page.tsx            # listagem com filtros + tooltips em ECC/Última IA
│   │   ├── inseminacoes/
│   │   │   ├── nova/page.tsx       # wizard de registro + IA
│   │   │   └── page.tsx            # histórico + tooltips em Predição IA/Técnica
│   │   ├── recomendacoes/page.tsx  # MatrizPicker → /recommend top 5
│   │   ├── globals.css             # tokens shadcn (light)
│   │   ├── layout.tsx              # AppShell + Toaster
│   │   ├── not-found.tsx           # 404 amigável
│   │   └── page.tsx                # dashboard (/stats)
│   ├── components/
│   │   ├── ui/                     # shadcn (button, card, dialog, tooltip, …)
│   │   ├── animal-search-input.tsx # autocomplete (matriz/reprodutor/cria)
│   │   ├── app-shell.tsx           # header + sidebar + bottom-tab (5 cols)
│   │   ├── ciclo-dialog.tsx        # dialog p/ criar/editar ciclo reprodutivo
│   │   ├── info-hint.tsx           # ícone "i" + tooltip Radix p/ siglas
│   │   ├── matriz-picker.tsx       # lista estilo /animais p/ escolha de matriz
│   │   ├── nav-items.ts            # itens de navegação (5 itens)
│   │   └── update-diagnostico-dialog.tsx
│   ├── hooks/
│   │   ├── use-debounce.ts
│   │   └── use-media-query.ts
│   └── lib/
│       ├── api.ts                  # apiFetch tipado + helpers
│       ├── types.ts                # tipos espelhando o backend
│       └── utils.ts                # cn()
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

## Dependências principais

Todas MIT/Apache, compatíveis com GPLv3:

| Pacote | Uso |
|---|---|
| `next` 14.2.x | Framework + App Router |
| `react` 18 | UI |
| `typescript` 5 | Type checking |
| `tailwindcss` 3 | Estilos utilitários |
| `tailwindcss-animate` | Animações |
| `class-variance-authority`, `clsx`, `tailwind-merge` | shadcn |
| `lucide-react` | Ícones |
| `@radix-ui/react-{dialog,select,radio-group,slider,label,slot,tooltip}` | Primitives shadcn |
| `react-hook-form` + `zod` + `@hookform/resolvers` | Formulários |
| `sonner` | Toasts |

## Telas

| Rota | Função |
|---|---|
| `/` | Dashboard (totais + por espécie + atalhos). Empty-state com CTA "Cadastrar primeiro animal" quando ainda não há dados |
| `/animais` | Listagem com chips de espécie/sexo, busca debounced, paginação 20/50, status da última IA. Cards mobile clicáveis (com ícone de olho) e tabela desktop com tooltips em ECC/Última IA |
| `/animais/[id]` | Ficha do animal: identificação, raça, dados genéticos, histórico de IA (se fêmea), CTA "Registrar inseminação" + diálogo de atualização de diagnóstico |
| `/animais/novo` | Cadastro: wizard mobile (Básico → Genético → Confirmação), 2 colunas desktop. **Save só via click explícito no step 3** (form submit é no-op puro) |
| `/inseminacoes` | Histórico com filtros por resultado e espécie + tooltips em Predição IA e em cada técnica (IATF, IA_repasse, IA_cervical, IA_laparoscopica, convencional). Diálogo "Confirmar resultado" / "Editar resultado" |
| `/inseminacoes/nova` | Wizard (Matriz → Reprodutor → Detalhes) com **predição automática** da IA e modal "Recomendar com IA". Mesmo guard de etapa do cadastro de animal |
| `/ciclos` | Lista global de ciclos reprodutivos com filtros por status e espécie. CRUD completo via `<CicloDialog>` (criar, fechar com parto/falha, vincular cria, remover). Mesmo estilo de cards/tabela das outras listagens |
| `/recomendacoes` | Etapa 1: **MatrizPicker** (chips de espécie c/ contagem + busca + cards clicáveis paginados — mesmo estilo de `/animais`). Etapa 2: top 5 reprodutores por matriz, com fatores positivos e CTA "Selecionar e registrar" |

## Decisões de design (resumo)

- **Mobile-first sempre.** `sm:`/`lg:` adicionam complexidade, nunca tiram.
- **Tabelas viram cards em mobile.** Nada de scroll horizontal.
- **Touch targets ≥ 44px no mobile.** Botões usam `h-11 sm:h-10`.
- **Bottom nav** no mobile, **sidebar** no desktop, **header** com nav inline no tablet.
- **Predição da IA com explicabilidade** — fatores positivos e negativos visíveis em todo lugar onde aparece probabilidade.
- **Tooltips informativos** (`<InfoHint>`) ao lado de toda sigla técnica que aparece em tabela (ECC, Última IA, Predição IA, IATF, IA_*). Glossário centralizado.
- **Wizards com submit blindado** — `<form onSubmit>` é `preventDefault` puro; save só via `onClick` explícito no botão final. Imune a Enter em number input e "Go" do teclado mobile.
- **Light mode apenas** — dark mode é roadmap pós-hackathon.

## Screenshots

> Placeholders. Capturar com o app rodando contra o seed (`apps/api/scripts/seed.py`).

- `docs/screen-dashboard-mobile.png` — Dashboard a 375px
- `docs/screen-dashboard-desktop.png` — Dashboard a 1440px
- `docs/screen-animais-list.png` — Listagem de animais
- `docs/screen-nova-inseminacao.png` — Wizard de inseminação com painel de predição
- `docs/screen-recomendacoes.png` — Top 5 com fatores positivos

(Adicione os arquivos em `apps/web/docs/` antes de gravar o pitch.)

## Status detalhado

Veja `apps/web/STATUS.md` para a checklist do que está pronto e o que ficou
de roadmap pós-hackathon.
