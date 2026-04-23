# Frontend Safe Boundaries

## Pode Alterar com Mais Liberdade

- composição visual do shell;
- espaçamentos;
- cards;
- hierarquia de botões;
- estados vazios;
- microinterações CSS;
- layout do dashboard;
- apresentação visual de leads, campanhas e mensagens;
- responsividade da camada de apresentação.

## Tratar com Cuidado

- componentes que misturam layout e lógica em `src/App.tsx`;
- sincronização entre lead, campanha e conversa;
- feedbacks de sucesso e erro;
- estados vazios que ajudam a demo;
- fluxo do simulador público.

## Não Mexer sem Revisão Técnica

- `src/services/crm.ts`
- `src/lib/env.ts`
- `src/lib/supabase.ts`
- `src/lib/conversation-verdict.ts`
- `src/utils/pipeline.ts`
- `supabase/functions/*`
- `supabase/migrations/*`
- `.env.example`
- `vercel.json`
- `package.json`
- `package-lock.json`

## Integrações Sensíveis

- Supabase Auth
- queries e mutações do workspace atual
- `plan-campaign-strategy`
- `generate-lead-messages`
- `create-simulation-link`
- `simulate-client-chat`
- `generate-smoke-conversation`

## Regras de Negócio que Não Podem Quebrar

### Auth

- login continua funcionando;
- criação de conta continua validando senha e confirmação;
- Google OAuth continua acessível;
- fluxo de redefinição não pode desaparecer.

### Workspace

- o shell autenticado só abre com workspace válido;
- dados nunca devem misturar workspaces.

### Leads e Pipeline

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

## Regra Prática

Se uma ferramenta de vibe coding sugerir mudança que toque lógica, integração, chamada Supabase ou Edge Function, a mudança deve ser revisada manualmente antes de entrar no repositório.
