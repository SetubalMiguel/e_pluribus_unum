# Projeto: e pluribus unum — de muitos, um — Hackathon Expoagro Crateús 2026

## Contexto

Plataforma web responsiva (mobile-first) para gestão genética e reprodutiva 
de bovinos, ovinos e caprinos, com IA para predição de prenhez e recomendação 
de cruzamentos. Submetida ao Hackathon Expoagro Crateús — Edital nº 01/2026.

**Prazo crítico:** Etapa 1 (vídeo pitch + protótipo funcional) até 22/05/2026.
**Prazo final:** Solução implementada e funcional até 05/06/2026.
**Licença obrigatória:** GNU GPL v3.0 — todas as dependências devem ser compatíveis.

## Decisões de arquitetura (não revisitar sem motivo forte)

- **NÃO é app nativo.** É site responsivo mobile-first que pode ser 
  "instalado" como atalho via PWA manifest.
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- **Storage local:** Dexie.js (IndexedDB) para funcionar offline
- **Backend:** FastAPI (Python 3.11) + SQLAlchemy 2.0 + Alembic
- **Banco:** PostgreSQL 16, usando JSONB para dados genéticos flexíveis por espécie
- **IA:** scikit-learn (GradientBoostingClassifier) + SHAP para explicabilidade
- **Deploy:** Vercel (front) + Render/Fly.io (API) + Supabase (DB)

## Diretrizes de código

- Mobile-first SEMPRE. Tudo começa estilizado para < 640px; `md:` e `lg:` 
  apenas adicionam complexidade.
- Touch targets de no mínimo 44px em mobile.
- Tabelas viram cards empilhados em mobile, nunca scroll horizontal.
- Formulários adaptam campos por espécie (bovino/ovino/caprino) usando JSONB.
- Toda dependência adicionada precisa ser GPL v3.0 compatível 
  (MIT, BSD, Apache 2.0, LGPL OK; SSPL/BUSL/Commons Clause NÃO).
- Comentários e mensagens de UI em **português brasileiro**.
- Código (variáveis, funções, tabelas) em **inglês**.

## Diferenciais a preservar

1. Offline-first real (Dexie + Service Worker + sync queue)
2. Suporte às 3 espécies com gestão integrada OU separada
3. IA explicável (SHAP, não caixa-preta)
4. LGPD by design (consentimento granular, audit log, criptografia)
5. Input por voz em campos longos (Web Speech API)
6. Acessibilidade real (alto contraste, fontes grandes, ícones semânticos)

