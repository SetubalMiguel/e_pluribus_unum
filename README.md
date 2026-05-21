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

**Modelo de dados (enums):**
- Especie: `BOVINO`, `OVINO`, `CAPRINO`
- Sexo: `MACHO`, `FEMEA`
- Tecnica: `IATF`, `convencional`, `IA_repasse`, `IA_cervical`, `IA_laparoscopica`
- ResultadoDiagnostico: `prenhe`, `vazia`, `aguardando`

**Autenticação:** Por enquanto, todas as requisições assumem o produtor demo. Sem login. CORS aberto para http://localhost:3000.

### Dados de seed

- 1 produtor demo
- 990 animais (300 matrizes + 30 reprodutores por espécie)
- 4500 inseminações com resultados já preenchidos
- Modelo de IA treinado com AUC ROC ~0.80

### Frontend (⬜ a fazer)

A construir em `apps/web/` usando Next.js 14 (App Router) + TypeScript.

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

## Estrutura desejada de apps/web/

