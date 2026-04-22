# UI Polish Changelog

## 2026-04-21 — Etapas 1, 2, 5 e 6 iniciadas

### Objetivo do bloco

Melhorar a percepção visual do app antes do Lovable, concentrando a primeira entrega em:

- layout-base
- dashboard
- mensagens IA
- mock de chat para envio simulado

### Alterações implementadas

- `src/App.tsx`
  - integração do `DashboardScreen`
  - integração do `MessagesScreen`
  - destaque visual do workspace ativo na sidebar
  - organização da área de conteúdo com `content-shell`
  - ajuste de microcopy com acentuação correta

- `src/types/domain.ts`
  - `CrmData` passou a expor `sentMessageEvents`

- `src/services/crm.ts`
  - carregamento real de `sent_message_events` para o front-end

- `src/utils/crm-ui.ts`
  - helpers visuais compartilhados para texto, datas, estágio e canal do lead

- `src/components/dashboard-screen.tsx`
  - hero do dashboard
  - métricas executivas
  - funil visual com barras
  - atividade recente baseada em dados reais

- `src/components/messages-screen.tsx`
  - bancada de geração mais legível
  - cards de contexto do lead e da campanha
  - cards das variações geradas
  - modal de mock de chat
  - confirmação visual do envio simulado
  - reaproveitamento de `sent_message_events` como histórico da conversa

- `src/styles.css`
  - novos estilos para shell, dashboard, overview cards, activity feed, workbench de mensagens e modal de chat
  - reforço de responsividade para os blocos novos

### Validações esperadas para fechar este bloco

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:smoke:crm`
- revisão manual desktop
- revisão manual mobile

### Riscos residuais antes da validação

- regressão visual por conflito com classes antigas
- classe nova sem cobertura no CSS
- import antigo sobrando no `App.tsx`
- modal de chat precisar de ajuste fino de responsividade

### Próximos blocos após validação

1. finalizar refinamentos da tela de leads
2. melhorar a tela de campanhas
3. revisão final de responsividade
4. polimento visual final antes do Lovable

## 2026-04-21 — Etapa 4 iniciada

### Objetivo do bloco

Transformar a tela de campanhas em uma biblioteca de playbooks mais clara para avaliação, sem mexer no fluxo já validado da Edge Function.

### Alterações implementadas

- `src/App.tsx`
  - resumo executivo de campanhas no topo
  - biblioteca de playbooks com cards e status
  - formulário de campanha com mais hierarquia visual
  - hints curtos para nome, gatilho, contexto e prompt

- `src/styles.css`
  - grid específico para o workspace de campanhas
  - chips de status para campanhas ativas/inativas e com/sem gatilho
  - cards de playbook e ajustes responsivos

### Validações executadas

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:smoke:crm`
- checagem visual local da tela de campanhas

### Observações

- alguns registros antigos de depuração no banco continuam com texto legado e acentuação ruim; isso é dado histórico, não regressão do componente novo
- o próximo alvo com maior ganho visual continua sendo a tela de leads

## 2026-04-21 — Etapa 3 executada

### Objetivo do bloco

Dar cara de operação comercial à tela de leads, reduzindo a sensação de CRUD cru e tornando a leitura do funil mais útil para avaliação.

### Alterações implementadas

- `src/App.tsx`
  - resumo superior com métricas de operação do funil
  - formulário de lead com hierarquia visual mais clara
  - painel `Lead em foco` com contexto, contato e checklist da etapa
  - kanban com cards mais ricos, destacando empresa, contato, origem, responsável e pendências
  - seleção visual do lead em foco sem quebrar o fluxo de edição e movimentação

- `src/styles.css`
  - grids específicos para o workspace de leads
  - pills de status para prontidão e pendências
  - cards mais ricos para o kanban
  - ajuste responsivo para spotlight, métricas e ações do card

### Validações executadas

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:smoke:crm`
- revisão manual desktop da tela de leads
- revisão manual mobile da tela de leads
- conferência de console sem erros ou warnings

### Observações

- o preview antigo em `127.0.0.1:4173` estava servindo uma versão local desatualizada; a validação visual final foi feita em um preview limpo da build atual em `127.0.0.1:4174`
- registros legados `[DEBUG]` continuam aparecendo por causa de dados históricos no banco, não por regressão da UI nova

### Próximo bloco

1. revisão transversal de responsividade e consistência entre dashboard, campanhas, leads e mensagens
2. polimento final de microcopy, estados vazios e feedbacks antes da etapa Lovable

## 2026-04-21 — Etapa 5 executada

### Objetivo do bloco

Fechar o polimento transversal antes do Lovable, reforçando leitura operacional, feedbacks de sucesso/erro e a clareza das telas de `Campos` e `Mensagens IA`.

### Alterações implementadas

- `src/App.tsx`
  - `StatusBar` passou a destacar melhor sucesso e erro com hierarquia visual clara
  - tela de `Campos` ganhou resumo executivo, biblioteca de campos e leitura orientada a operação
  - painel de regras por etapa ficou mais legível, com divisão entre campos padrão e personalizados

- `src/components/messages-screen.tsx`
  - faixa de leitura do fluxo antes da geração, deixando explícito qual campanha está abordando qual lead
  - reforço do contexto operacional antes da demonstração do chat

- `src/styles.css`
  - novos padrões visuais para feedbacks, painéis de `Campos` e faixa contextual de `Mensagens IA`
  - ajustes responsivos finais para desktop e mobile

### Validações executadas

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:smoke:crm`
- checagem visual desktop e mobile no preview limpo em `127.0.0.1:4174`
- conferência de console sem erros

### Observações

- o fluxo principal continua íntegro: login, workspace, lead, campanha, geração de mensagens e envio simulado
- registros históricos `[DEBUG]` ainda aparecem em alguns dados antigos do banco, mas não são regressão da interface atual

### Situação da fase

- blocos planejados para o polimento pré-Lovable foram concluídos
- o próximo passo deixa de ser refino local de UI e passa a ser validação final em produção e migração guiada para Lovable

## 2026-04-21 — Aprimoramento do smoke test

### Objetivo do bloco

Transformar o smoke test do CRM em um seed de demonstração realista, útil para validar a operação e também para deixar o produto visualmente crível em um perfil zerado.

### Alterações implementadas

- `scripts/smoke-crm-flow.mjs`
  - o smoke deixou de criar um único lead/campanha
  - agora cria um workspace demo dedicado e reexecutável
  - semeia campos personalizados, regras por etapa, leads realistas, campanhas com gatilho e histórico de conversa
  - mantém validação real da Edge Function com geração de mensagens pela OpenAI

- `supabase/migrations/20260421201000_enrich_sent_message_events_for_smoke_chat.sql`
  - adiciona metadados leves no histórico de mensagens para suportar direção, remetente, canal e status de entrega/leitura/resposta

- `src/components/messages-screen.tsx`
  - o mock de chat passa a diferenciar mensagens do SDR e respostas do cliente no mesmo histórico

- `docs/qa-checklist.md` e `.env.example`
  - documentação das novas variáveis e do comportamento do smoke realista

## 2026-04-22 — Smoke realista em duas ondas e simulador de cliente

### Objetivo

Preparar o ambiente para avaliação antes da etapa Lovable, com volume operacional e conversas realistas geradas por IA em vez de exemplos fixos.

### Alterações

- `supabase/migrations/20260422093000_conversation_threads_and_simulator_tokens.sql`
  - adiciona `conversation_threads`, `conversation_messages` e `conversation_simulation_tokens`
  - adiciona RLS, grants, índices e trigger de integridade para impedir referências cruzadas de workspace
- `supabase/functions/create-simulation-link`
  - cria link temporário do simulador após validar usuário e membership
- `supabase/functions/simulate-client-chat`
  - permite abrir uma conversa por token
  - registra resposta do cliente
  - gera próxima resposta do SDR com OpenAI e fallback
- `src/components/client-simulator-screen.tsx`
  - cria a janela pública do cliente para testar respostas
- `src/components/messages-screen.tsx`
  - adiciona prévia operacional da conversa
  - adiciona atalho pequeno para abrir o simulador em nova janela
- `scripts/smoke-crm-flow.mjs`
  - passa a criar 100 leads, 4 campanhas e 75 conversas em duas ondas
  - persiste mensagens reais geradas por IA, eventos simulados e tokens do simulador
  - usa OpenAI local quando disponível ou Edge Function autenticada com secrets remotos quando a chave local não existe
- `docs/smoke-realista-ondas.md`
  - documenta estratégia, variáveis, validações e execução

### Validação

- `npm run test`
- `npm run lint`
- `npm run build`

O smoke completo depende das migrations aplicadas e das Edge Functions publicadas no Supabase. `OPENAI_API_KEY` local é opcional quando os secrets remotos estão configurados.
