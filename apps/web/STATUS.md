# Frontend — Status para o Pitch

Snapshot do estado do `apps/web/` na véspera da gravação. O backend é
assumido ativo em `http://localhost:8000` com o seed aplicado.

## ✅ Pronto

### Telas

- [x] **Dashboard (`/`)** — `/stats`, cards consolidados + por espécie, atalhos
      para Novo animal / Nova inseminação / Recomendar. Empty-state com CTA
      "Cadastrar primeiro animal" quando `total_animais === 0`.
- [x] **Lista de animais (`/animais`)** — chips de espécie/sexo com contagens,
      busca debounced (300 ms), paginação 20/50, status da última IA por
      matriz, FAB mobile + botão inline desktop.
- [x] **Cadastro de animal (`/animais/novo`)** — wizard 3 passos no mobile
      (Básico → Genético → Confirmação), formulário em 2 colunas no desktop;
      validação `react-hook-form` + `zod`; raça filtrada por espécie; ECC com
      slider 1–5 (decimal 0.1); 409 mostra erro inline na identificação.
- [x] **Detalhe do animal (`/animais/[id]`)** — header com avatar/raça/sexo,
      dados genéticos formatados, histórico de inseminações (cards mobile /
      tabela desktop), CTA contextual (Registrar IA para fêmea; placeholder
      "Em breve" para reprodutor).
- [x] **Lista de inseminações (`/inseminacoes`)** — chips de resultado e
      espécie, paginação 20/50, links pra ficha da matriz, FAB.
- [x] **Nova inseminação (`/inseminacoes/nova`)** — wizard 3 passos no mobile,
      tela única com aside sticky no desktop, **predição automática** com
      debounce 400 ms ao preencher os 4 campos chave, modal "Recomendar com IA"
      com data/técnica/parentesco próprios, exibição de classificação (alta/
      média/baixa) e top 4 fatores positivos/negativos. Pré-fill por URL para
      matriz, reprodutor, técnica e data.
- [x] **Recomendações (`/recomendacoes`)** — top 5 com rank #1 em destaque
      full-width, fatores positivos por reprodutor, idade enriquecida via
      `getAnimal()`, CTA "Selecionar e registrar inseminação" pré-preenche
      `/inseminacoes/nova` por query string.
- [x] **404 customizado** (`not-found.tsx`) — mensagem amigável + atalhos.

### Estados de UX

- [x] **Loading** em todas as telas com fetch: spinner inline e/ou skeletons
      do shadcn.
- [x] **Empty** com mensagem dedicada e CTA quando faz sentido (dashboard
      vazio, listas filtradas sem resultado, recommend sem matches).
- [x] **Erro** tratado em todos os `.then()` (`try/catch` via `apiFetch`):
      mensagem com cor destrutiva inline; `ApiError.status === 409` mapeado
      para erro de campo no cadastro de animal; `404` na ficha do animal mostra
      tela dedicada.
- [x] **Toaster global** (`sonner`) montado em `layout.tsx`: usado para
      sucesso/erro em submits e ações da IA.

### Responsividade e acessibilidade

- [x] **Mobile-first**: cada tela começa estilizada para `< 640px`, `sm:`/
      `lg:` apenas adicionam.
- [x] **Touch targets ≥ 44px no mobile**: `Button` é `h-11 sm:h-10`; chips
      `min-h-11 sm:min-h-9`; FAB 56×56; bottom-nav `min-h-[56px]`.
- [x] **Sem scroll horizontal em mobile**: tabelas viram cards (`hidden lg:`
      ou `sm:hidden`); botões com `min-w-[8rem]` cabem em 343 px úteis a 375 px.
- [x] **Navegação dupla**: sidebar no desktop, bottom-tab no mobile, links
      inline no header para tablet.
- [x] **Aria-roles** em barras de progresso (`role="progressbar"` +
      `aria-valuenow/min/max`), combobox do autocomplete (`role="combobox"/
      listbox/option"` + `aria-expanded`/`aria-selected`), chips
      (`aria-pressed`), passos do wizard (`aria-current="step"`).
- [x] **Safe-area** respeitada nos rodapés fixos via
      `pb-[max(env(safe-area-inset-bottom),0.75rem)]`.
- [x] **Animações sutis**: `transition-colors`, `transition-transform`,
      `hover:scale-105` em FABs e tiles do dashboard; Radix Dialog e Select
      com animações `data-[state=open]:animate-in` via `tailwindcss-animate`.

### PWA

- [x] `public/manifest.json` com `name`, `short_name`, `display:standalone`,
      `theme_color:#15803d`, `background_color:#fff`, `lang:pt-BR`.
- [x] Ícones reais: `icon-192.png`, `icon-512.png` (192×192 e 512×512 RGBA,
      gerados a partir de `icon.svg`), mais o SVG como fallback escalável.
- [x] `themeColor` e `viewport.viewportFit:"cover"` declarados no `layout.tsx`.

### Qualidade de código

- [x] **TypeScript estrito**: `strict: true`, `noEmit`, alias `@/*`.
- [x] **`npx tsc --noEmit`** passa limpo.
- [x] **Tipos espelhando o backend** em `src/lib/types.ts`. Wire values:
      `Especie = "bovino"|"ovino"|"caprino"`, `Sexo = "M"|"F"`.
- [x] **Cliente HTTP único** (`src/lib/api.ts`) com `apiFetch<T>` tipado,
      `ApiError` com `status` + `payload`, default `NEXT_PUBLIC_API_URL=
      http://localhost:8000`.
- [x] **Componentes shadcn** (light only, paleta neutral, primary
      verde-700 `#15803d`).
- [x] **Sem `localStorage`/`sessionStorage`** — só `useState`/`useReducer`.
- [x] **Sem deps GPL-incompatíveis** — todas MIT/Apache.
- [x] **`apps/web/README.md`** com instruções, estrutura e scripts.

## 🟡 Limitações conhecidas (não bloqueiam o pitch)

- **Screenshots placeholders**: `apps/web/docs/` ainda não tem capturas reais
  do app. Listadas como TODO no README; gravar com seed aplicado antes do
  vídeo. (5 min antes da gravação.)
- **Enriquecimento N+1**: lista de inseminações + lista de animais + página
  de recomendações fazem `getAnimal()` paralelo por linha para mostrar
  nome/idade. Bom para 50 itens, problemático para milhares. Em produção,
  expandir `AnimalResumo` no backend ou criar endpoint `/animals?ids=...`.
- **Tabela densa no desktop** ainda usa `overflow-auto` no wrapper do
  shadcn (Table). A `<div>` envolvente tem essa propriedade; nenhuma das
  nossas telas atinge largura suficiente para acionar, mas o componente
  pode rolar horizontalmente se conteúdos longos forem injetados no
  futuro — mantido como nice-to-have a investigar.
- **Verificação visual nos 3 viewports**: o código foi auditado por
  inspeção (breakpoints `sm:`/`lg:`, tabelas escondidas em mobile, touch
  targets `h-11`), mas não testado num navegador real porque o ambiente
  do agente não roda DevTools. Recomendado abrir Chrome DevTools em 375,
  768 e 1440 antes do pitch e clicar nas telas-chave.
- **Backend offline durante o desenvolvimento**: as telas foram exercitadas
  no caminho de erro (toast/empty/skeleton aparecem corretamente sem API).
  Caminho feliz só é confirmado com `apps/api` rodando + seed aplicado.
- **Ações finais de IA** (`/predict`, `/recommend`) são feitas no caminho
  crítico do submit — se a API estiver lenta, a tela mostra spinner por
  até 400 ms (debounce) + RTT. Aceitável para o demo; para produção dá pra
  trocar por mutation com cache + revalidate.

## 🗺️ Roadmap pós-hackathon

### Funcionalidade

- [ ] **Login real (JWT)** — atualmente todo request assume o produtor demo.
- [ ] **Edição de animal** (`PATCH /animals/{id}`) — só temos criação.
- [ ] **Atualizar diagnóstico** (`PATCH /inseminations/{id}`) — depois que
      a IA prevê, falta a tela pro produtor marcar prenhe/vazia.
- [ ] **Soft delete de animal** com confirmação (`DELETE /animals/{id}`).
- [ ] **Detalhe de inseminação** (`/inseminacoes/[id]`) com histórico de
      diagnóstico e re-predição.
- [ ] **Página do reprodutor como macho** — botão já está visível na ficha
      mas leva para "Em breve".
- [ ] **Importação CSV** de rebanho/inseminações.

### UX e qualidade

- [ ] **Dark mode** (mesma paleta neutral, tokens via CSS vars já prontos).
- [ ] **i18n** — hoje tudo em pt-BR hardcoded.
- [ ] **Service worker / offline real** com cache de leitura e fila de
      writes (Dexie está no plano original mas não está em uso ainda).
- [ ] **Notificações push** (web push) para retorno de cio e diagnóstico.
- [ ] **Skeleton mais fiel ao layout final** — algumas telas usam blocos
      genéricos.
- [ ] **Voz**: dictar identificação/observações via `webkitSpeechRecognition`
      (citado como diferencial no README do projeto).

### Performance

- [ ] **Substituir o N+1** de enriquecimento por endpoint plural no backend.
- [ ] **Cache cliente** (React Query / SWR) — hoje usamos `useEffect` puro.
- [ ] **Streaming de página** para o dashboard usando RSC + Suspense.

### Observabilidade e deploy

- [ ] **Sentry** ou similar para captura de erros em produção.
- [ ] **Build de produção testado** (`npm run build` no CI).
- [ ] **Deploy na Vercel** com `NEXT_PUBLIC_API_URL` apontando para a API
      hospedada (`apps/api` ainda local).
- [ ] **Lighthouse PWA 100** — depende do service worker + ícones maskable
      validados.

## Como rodar a checklist do pitch

```bash
# Backend (terminal 1)
cd apps/api
poetry run uvicorn app.main:app --reload

# Frontend (terminal 2)
cd apps/web
npm run dev

# Abre o navegador em http://localhost:3000 e clica em:
# 1. Dashboard
# 2. Animais → uma matriz → Registrar inseminação
# 3. No wizard, escolhe reprodutor manualmente; observa a predição em tempo real
# 4. Confirma; verifica toast de sucesso e volta pra ficha da matriz
# 5. Volta ao dashboard → Recomendações → escolhe matriz → Gerar
# 6. Clica em "Selecionar e registrar" no rank #1 → confirma a inseminação
```
