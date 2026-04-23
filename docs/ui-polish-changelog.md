# UI Polish Changelog

## 2026-04-22 — Alinhamento final de vibe coding e polimento seguro

### Objetivo

Remover a dependência conceitual de uma ferramenta específica de frontend e consolidar a estratégia real de entrega: base funcional própria, apoio de stack de vibe coding para leitura/refino visual, GitHub como fonte da verdade e Vercel como deploy.

### Alterações

- `README.md`
  - troca a narrativa de ferramenta única por estratégia de vibe coding com Bolt como apoio de auditoria visual.
  - mantém limites de segurança, Supabase e Vercel claros.

- `CONSTITUICAO_CODEX_SDR_CRM_VIBE_CODING.md`
  - atualiza a regra operacional para preservar a base funcional acima de qualquer sugestão externa.
  - remove dependência normativa de ferramenta específica.

- `docs/frontend-vibe-coding/*`
  - substitui a pasta antiga de preparação por documentação neutra de vibe coding.
  - preserva screenshots úteis para referência visual.
  - documenta o diagnóstico do Bolt e as fronteiras seguras para refino.

- `src/styles.css` e `index.html`
  - adicionam Inter via Google Fonts.
  - adicionam tokens visuais globais.
  - corrigem o botão `.secondary`.
  - reforçam indicador de navegação ativa, cards, estados vazios e feedbacks com microinterações CSS.

### Validação esperada

- `npm run test`
- `npm run lint`
- `npm run build`


## 2026-04-21 — Etapas 1, 2, 5 e 6 iniciadas

### Objetivo do bloco

Melhorar a percepção visual do app antes da etapa padronizada de refinamento com stack de vibe coding, concentrando a primeira entrega em:

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
4. polimento visual final com apoio de vibe coding

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
2. polimento final de microcopy, estados vazios e feedbacks antes da etapa de refinamento com vibe coding

## 2026-04-21 — Etapa 5 executada

### Objetivo do bloco

Fechar o polimento transversal antes da etapa de refinamento com stack de vibe coding, reforçando leitura operacional, feedbacks de sucesso/erro e a clareza das telas de `Campos` e `Mensagens IA`.

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

- blocos planejados para o polimento pré-refinamento foram concluídos
- o próximo passo deixa de ser apenas refino local de UI e passa a ser validação final em produção e refinamento guiado por stack de vibe coding

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

Preparar o ambiente para avaliação antes da etapa de refinamento com stack de vibe coding, com volume operacional e conversas realistas geradas por IA em vez de exemplos fixos.

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

## 2026-04-22 — Correção do funil operacional e seletor do simulador

### Objetivo

Corrigir a leitura da tela de leads com grande volume de dados e permitir que o usuário escolha explicitamente qual conversa abrir no simulador autenticável.

### Alterações

- `src/styles.css`
  - o funil operacional passou a usar colunas com largura controlada e rolagem horizontal estável
  - cada coluna ganhou rolagem vertical própria, evitando sobreposição entre etapas
  - os cards de lead deixaram de comprimir quando há muitos registros na mesma etapa
  - textos longos de contato, cargo, empresa e etiquetas agora quebram linha sem estourar o layout

- `src/components/messages-screen.tsx`
  - o painel `Simulador autenticável` ganhou seletor de conversa por lead e campanha
  - o atalho de abertura em nova janela agora usa a conversa selecionada no seletor
  - a prévia da conversa passa a acompanhar o lead selecionado no simulador, sem depender apenas do lead ativo na bancada de geração

### Validação

- `npm run test`
- `npm run lint`
- `npm run build`
- checagem visual local em `127.0.0.1:5173` da tela de leads com volume alto
- checagem visual local do seletor de conversa em `Mensagens IA`

## 2026-04-22 — Guia operacional e dashboard estratégico

### Objetivo

Melhorar a compreensão do fluxo completo do CRM e transformar o dashboard em uma leitura mais estratégica para avaliação e operação.

### Alterações

- `src/App.tsx`
  - adiciona um guia operacional minimizável no topo das telas autenticadas
  - adiciona modal `Ver lógica` com a explicação do fluxo completo: dashboard, leads, campos, campanhas e mensagens IA
  - o guia muda o foco conforme a aba ativa, ajudando o usuário a entender o que fazer em cada tela

- `src/components/dashboard-screen.tsx`
  - transforma o dashboard em cockpit estratégico
  - adiciona diagnóstico executivo em modal sobreposto
  - adiciona cartões de gargalo, qualidade de conversas e ação recomendada
  - adiciona seletor interativo de etapa com volume, campanha ligada e amostra de leads
  - torna as barras do funil clicáveis para destacar rapidamente uma etapa
  - troca a taxa de resposta para métrica limitada a conversas com pelo menos uma resposta, evitando percentual acima de 100%

- `src/styles.css`
  - adiciona estilos do guia operacional, modal de lógica, diagnóstico executivo e cards estratégicos
  - reforça responsividade dos novos blocos e evita overflow em modais no mobile

### Validação

- `npm run test`
- `npm run lint`
- `npm run build`
- checagem visual desktop do dashboard em `127.0.0.1:5173`
- checagem visual mobile do guia, modal e menu de navegação
- conferência de console sem erros

## 2026-04-22 — Mensagens IA com busca de lead e conversa sincronizada

### Objetivo

Deixar a operação de geração e simulação mais legível, garantindo que o simulador mostre a conversa do lead selecionado e que os seletores sigam ordem alfabética.

### Alterações

- `src/components/messages-screen.tsx`
  - ordena leads e campanhas ativas em ordem alfabética
  - substitui a escolha de lead por campo com digitação livre e sugestão automática
  - sincroniza a conversa do simulador autenticável com o lead atualmente selecionado na geração
  - restringe o seletor de conversa às threads do lead em foco, evitando contexto cruzado

- `src/styles.css`
  - adiciona estilos do novo campo de busca de lead com ícone e sugestão visual consistente

### Validação

- `npm run test`
- `npm run lint`
- `npm run build`
- checagem visual local da tela `Mensagens IA`

## 2026-04-22 — Exemplos de preenchimento nos formulários

### Objetivo

Reduzir dúvida de preenchimento nos formulários principais, deixando o formato esperado claro logo dentro do campo ou em dica curta abaixo dele.

### Alterações

- `src/App.tsx`
  - adiciona exemplos de preenchimento em autenticação, redefinição de senha e criação de workspace
  - adiciona exemplos nos campos principais de lead: nome, e-mail, telefone, empresa, cargo, origem, observações e campos personalizados
  - adiciona exemplos nos campos principais de campanha: nome, contexto e prompt de geração

- `src/components/messages-screen.tsx`
  - adiciona exemplos no campo de busca de lead da tela `Mensagens IA`

### Validação

- `npm run test`
- `npm run lint`
- `npm run build`

## 2026-04-22 — Polimento final com apoio de vibe coding

### Objetivo

Fechar a base atual do CRM antes da etapa de refinamento com stack de vibe coding, corrigindo microcopy visível, acentuação e documentação do teste final com usuário limpo.

### Alterações

- `src/App.tsx`
  - corrige acentuação do fluxo de campanha em duas etapas
  - padroniza mensagens de erro, placeholders e dicas do plano de ação gerado por IA
  - mantém o formulário de campanha mais claro para revisão, aprovação e edição do prompt antes de salvar

- `docs/block-8-polimento-final-frontend.md`
  - documenta o fechamento do bloco 8
  - registra como preparar o `.env.local` para o smoke final em usuário limpo
  - reforça que `OPENAI_API_KEY` não deve ser exposta na Vercel do frontend

### Validação

- `npm run test`
- `npm run lint`
- `npm run build`

## 2026-04-22 — Ajuste do botão de minimizar no mobile

### Objetivo

Corrigir o botão de minimizar do guia rápido no mobile, que estava herdando largura total e ficando grande demais.

### Alterações

- `src/styles.css`
  - adiciona exceção específica para `.operation-guide-actions .icon-only` no breakpoint mobile
  - fixa altura e largura em `34px`
  - remove o efeito visual de quadrado gigante causado por `aspect-ratio` com largura esticada

### Validação

- `npm run lint`
- `npm run build`

## 2026-04-22 — Trava contra rolagem horizontal no mobile

### Objetivo

Impedir que telas autenticadas fiquem descentralizadas ou abram rolagem horizontal em viewports mobile.

### Alterações

- `src/styles.css`
  - adiciona limites globais em `html`, `body`, `#root`, `.app-shell`, `.content`, `.content-shell` e `.stack`
  - reforça `max-width: 100%`, `min-width: 0` e `overflow-x: clip/hidden` nos contêineres principais
  - adiciona proteção mobile para barra superior, guia operacional, painéis, métricas e cards

### Validação

- inspeção local em viewport mobile `390px`
- inspeção local em viewport mobile `360px`
- checagem de `scrollWidth === innerWidth`
- `npm run lint`
- `npm run build`

## 2026-04-22 — Reposicionamento das ações da sidebar

### Objetivo

Deixar as ações globais mais fáceis de encontrar, movendo `Atualizar` e `Sair` para baixo do bloco `Workspace ativo`.

### Alterações

- `src/App.tsx`
  - move os botões `Atualizar` e `Sair` para dentro do bloco superior da sidebar
  - mantém o comportamento de fechar o menu mobile ao atualizar ou sair

- `src/styles.css`
  - remove o empurrão automático das ações para o rodapé da sidebar

### Validação

- `npm run lint`
- `npm run build`
