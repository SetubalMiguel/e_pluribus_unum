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
│   ├── icon-192.png       # PWA
│   ├── icon-512.png
│   ├── icon.svg           # ícone vetorial U em verde-700
│   └── manifest.json
├── src/
│   ├── app/
│   │   ├── animais/
│   │   │   ├── [id]/page.tsx       # detalhe do animal
│   │   │   ├── novo/page.tsx       # wizard de cadastro
│   │   │   └── page.tsx            # listagem com filtros
│   │   ├── inseminacoes/
│   │   │   ├── nova/page.tsx       # wizard de registro + IA
│   │   │   └── page.tsx            # histórico
│   │   ├── recomendacoes/page.tsx  # /recommend top 5
│   │   ├── globals.css             # tokens shadcn (light)
│   │   ├── layout.tsx              # AppShell + Toaster
│   │   ├── not-found.tsx           # 404 amigável
│   │   └── page.tsx                # dashboard (/stats)
│   ├── components/
│   │   ├── ui/                     # shadcn (button, card, dialog, …)
│   │   ├── animal-search-input.tsx # autocomplete reutilizado
│   │   ├── app-shell.tsx           # header + sidebar + bottom-tab
│   │   └── nav-items.ts            # itens de navegação
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
| `@radix-ui/react-{dialog,select,radio-group,slider,label,slot}` | Primitives shadcn |
| `react-hook-form` + `zod` + `@hookform/resolvers` | Formulários |
| `sonner` | Toasts |

## Telas

| Rota | Função |
|---|---|
| `/` | Dashboard (totais + por espécie + atalhos). Empty-state com CTA "Cadastrar primeiro animal" quando ainda não há dados |
| `/animais` | Listagem com chips de espécie/sexo, busca debounced, paginação 20/50, status da última IA |
| `/animais/[id]` | Ficha do animal: identificação, raça, dados genéticos, histórico de IA (se fêmea), CTA "Registrar inseminação" |
| `/animais/novo` | Cadastro: wizard mobile (Básico → Genético → Confirmação), 2 colunas desktop |
| `/inseminacoes` | Histórico com filtros por resultado e espécie |
| `/inseminacoes/nova` | Wizard (Matriz → Reprodutor → Detalhes) com **predição automática** da IA e modal "Recomendar com IA" |
| `/recomendacoes` | Top 5 reprodutores por matriz, com fatores positivos e CTA "Selecionar e registrar" |

## Decisões de design (resumo)

- **Mobile-first sempre.** `sm:`/`lg:` adicionam complexidade, nunca tiram.
- **Tabelas viram cards em mobile.** Nada de scroll horizontal.
- **Touch targets ≥ 44px no mobile.** Botões usam `h-11 sm:h-10`.
- **Bottom nav** no mobile, **sidebar** no desktop, **header** com nav inline no tablet.
- **Predição da IA com explicabilidade** — fatores positivos e negativos visíveis em todo lugar onde aparece probabilidade.
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
