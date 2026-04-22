# v0 Safe Boundaries

## O que o v0 pode alterar com mais liberdade

- estrutura visual do shell;
- layout das telas principais;
- espaçamentos;
- cards;
- composição dos formulários;
- modais e painéis;
- hierarquia de botões;
- organização visual do dashboard;
- organização visual de leads, campanhas e mensagens;
- responsividade da camada de apresentação.

## O que deve ser tratado com cuidado

- componentes que já misturam layout com lógica em `src/App.tsx`;
- sincronização entre seleção de lead, campanha e conversa;
- feedbacks visuais de sucesso e erro;
- estados vazios que ajudam a demo;
- fluxo do simulador público.

## O que não deve ser mexido inicialmente

- `src/services/crm.ts`
- `src/lib/env.ts`
- `src/lib/supabase.ts`
- `src/lib/conversation-verdict.ts`
- `src/utils/pipeline.ts`
- `supabase/functions/*`
- `supabase/migrations/*`
- `.env.example`
- `vercel.json`

## Integrações sensíveis

- Supabase Auth
- queries e mutações do workspace atual
- `plan-campaign-strategy`
- `generate-lead-messages`
- `create-simulation-link`
- `simulate-client-chat`
- `generate-smoke-conversation`

## Regras de negócio que não podem quebrar

### Auth

- login continua funcionando;
- criação de conta continua validando senha e confirmação;
- Google OAuth continua acessível;
- fluxo de redefinição não pode desaparecer.

### Workspace

- o shell autenticado só abre com workspace válido;
- dados nunca devem misturar workspaces.

### Leads e pipeline

- mudança de etapa precisa continuar respeitando obrigatoriedade;
- lead em foco precisa continuar acessível;
- board precisa continuar refletindo o pipeline real.

### Campanhas

- briefing e plano de ação da IA precisam continuar separados do save final;
- prompt final continua revisável antes de salvar.

### Mensagens IA

- a geração depende de lead + campanha + workspace;
- a conversa operacional precisa continuar legível;
- a abertura do simulador não pode ser removida.

### Simulador

- rota pública `/client-simulator` precisa continuar funcional;
- token inválido deve continuar mostrando erro e retry;
- thread persistida deve continuar legível.

## Regra prática de segurança

Se o v0 sugerir mudança que toque lógica, integrações, chamadas Supabase ou Edge Functions, essa mudança deve ser revisada manualmente antes de entrar no repositório.
