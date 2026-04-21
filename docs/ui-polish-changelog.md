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
