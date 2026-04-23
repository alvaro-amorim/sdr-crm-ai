# SDR Expert CRM

Mini CRM para operação de SDR com autenticação Supabase, isolamento por workspace, funil comercial, campanhas com apoio de IA e simulador de conversa persistida.

## Visão Geral

O projeto foi desenvolvido de forma iterativa:

1. primeiro consolidou a base funcional do produto;
2. depois estabilizou regras de negócio, integrações com IA, simulador e smoke operacional;
3. por fim, o frontend passou por refinamento incremental com apoio de ferramentas de vibe coding, mantendo este repositório como fonte de verdade funcional.

Regras operacionais ativas:

- **GitHub** é a fonte de verdade do código;
- **Vercel** é o fluxo preferencial de deploy do frontend;
- ferramentas de vibe coding como **Bolt** podem apoiar análise e refinamento visual, mas nenhuma saída entra sem revisão, validação e commit neste repositório.

## Stack

- React 19 + TypeScript + Vite
- Supabase Auth, Postgres, RLS e Edge Functions
- OpenAI para planejamento e geração de mensagens
- Zod para validação de ambiente e payloads
- Vitest para regras críticas e utilitários do smoke
- Vercel para deploy do frontend

## Fluxo Principal Entregue

O fluxo central hoje cobre:

- cadastro, login, logout e recuperação de senha com Supabase Auth;
- login com Google via Supabase OAuth;
- criação do primeiro workspace com funil padrão;
- CRUD de leads com campos padrão e personalizados;
- validação de campos obrigatórios por etapa;
- leitura do pipeline em kanban;
- criação de campanhas com planejamento assistido por IA em duas etapas;
- geração de 2 ou 3 mensagens por lead;
- envio simulado com persistência de thread;
- simulador público por token para responder como cliente;
- dashboard operacional com métricas, atalhos e drill-down.

## Funcionalidades Implementadas

- autenticação com Supabase Auth;
- login com Google OAuth;
- recuperação e redefinição de senha;
- workspace inicial com membership do owner;
- isolamento por `workspace_id`;
- RLS nas tabelas principais;
- CRUD de leads;
- campos personalizados por workspace;
- regras de obrigatoriedade por etapa;
- campanhas com briefing, plano de ação e prompt final revisável;
- Edge Functions:
  - `generate-lead-messages`
  - `plan-campaign-strategy`
  - `create-simulation-link`
  - `simulate-client-chat`
  - `generate-smoke-conversation`
- persistência de `generated_messages`, `sent_message_events`, `conversation_threads` e `conversation_messages`;
- simulador público por token;
- smoke test realista com volume operacional.

## Setup Local

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar `.env.local`

Use `.env.example` como base:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

`OPENAI_API_KEY` é opcional no ambiente local e serve apenas para o smoke quando você quiser gerar as conversas diretamente do script. A chave nunca deve ficar no frontend publicado.

### 3. Linkar o Projeto Supabase

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
```

### 4. Aplicar as Migrations

As migrations atuais do repositório são:

- `20260421150000_initial_schema.sql`
- `20260421162000_workspace_bootstrap_and_integrity.sql`
- `20260421170000_authenticated_table_grants.sql`
- `20260421171500_fix_portuguese_stage_accents.sql`
- `20260421183000_fix_workspace_integrity_trigger.sql`
- `20260421201000_enrich_sent_message_events_for_smoke_chat.sql`
- `20260422093000_conversation_threads_and_simulator_tokens.sql`
- `20260422104500_simulator_public_rpc.sql`
- `20260422133500_fix_simulator_verdict_and_stage_movement.sql`
- `20260422143000_prompt_purpose_state_machine.sql`

Aplicação recomendada:

```bash
npx supabase db push
```

Se o projeto remoto já tiver parte do histórico aplicada, use `migration repair` apenas para refletir o estado real do banco antes do `db push`.

### 5. Configurar Auth no Supabase

- habilitar confirmação de e-mail para cadastro tradicional;
- configurar templates de e-mail usando `docs/supabase-auth-email-templates.md`;
- usar `https://sdr-crm-ai-wine.vercel.app` como `Site URL` de produção;
- adicionar estas URLs de redirect:
  - `https://sdr-crm-ai-wine.vercel.app`
  - `http://127.0.0.1:5173`
  - `http://localhost:5173`
- habilitar Google em `Authentication > Sign In / Providers > Google`.

### 6. Configurar Secrets das Edge Functions

No ambiente Supabase Functions:

```bash
OPENAI_API_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 7. Publicar as Edge Functions

```bash
npx supabase functions deploy generate-lead-messages
npx supabase functions deploy plan-campaign-strategy
npx supabase functions deploy create-simulation-link
npx supabase functions deploy simulate-client-chat
npx supabase functions deploy generate-smoke-conversation
```

### 8. Rodar o Frontend Local

```bash
npm run dev
```

## Estratégia de Frontend e Vibe Coding

O frontend não será refeito do zero. A estratégia ativa é:

- preservar a base funcional validada;
- usar ferramentas de vibe coding para acelerar análise, ideias de UX e refinamentos visuais controlados;
- tratar essas ferramentas como apoio, não como fonte única do código final;
- reintegrar melhorias em blocos pequenos neste repositório;
- validar `test`, `lint` e `build` antes de commit ou entrega.

O Bolt foi usado como apoio de auditoria visual do frontend, identificando a estrutura real da SPA, telas principais e refinamentos conservadores para tipografia, navegação, cards e estados vazios.

Documentos de apoio:

- `docs/frontend-vibe-coding/frontend-vibe-coding-context.md`
- `docs/frontend-vibe-coding/frontend-safe-boundaries.md`
- `docs/frontend-vibe-coding/frontend-priority-surfaces.md`
- `docs/frontend-vibe-coding/frontend-validation-checklist.md`
- `docs/frontend-vibe-coding/frontend-review-workflow.md`

## Deploy na Vercel

- o deploy preferencial e final do frontend é a **Vercel**;
- configurar na Vercel apenas:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- `vercel.json` mantém fallback SPA para rotas diretas como `/client-simulator`;
- `OPENAI_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` ficam apenas no Supabase, nunca na Vercel do frontend.

Deploy atual de referência:

- `https://sdr-crm-ai-wine.vercel.app`

## Segurança e Multi-Tenancy

- o frontend não usa `SUPABASE_SERVICE_ROLE_KEY`;
- apenas variáveis `VITE_` seguras devem aparecer no navegador;
- toda entidade de negócio é ligada a `workspace_id`;
- o banco aplica membership e RLS nas tabelas principais;
- triggers de integridade bloqueiam referências cruzadas entre workspace, etapa, lead, campanha e conversa;
- as Edge Functions validam autenticação e vínculo com o workspace antes de operar.

## IA e Edge Functions

### Planejamento de Campanha

`plan-campaign-strategy` recebe o briefing da campanha e devolve:

- resumo da abordagem;
- diferenciais sugeridos;
- objeções previstas;
- prompt final sugerido.

O usuário pode aprovar, regenerar ou editar antes de salvar a campanha.

### Geração de Mensagens

`generate-lead-messages`:

- valida usuário e workspace;
- lê lead, campanha e campos relevantes;
- monta o prompt de geração;
- chama a OpenAI;
- salva 2 ou 3 variações em `generated_messages`.

Fallback atual na própria OpenAI:

- `gpt-4o-mini`
- `gpt-4o`
- `gpt-4.1-mini`

Sem sucesso em todas as tentativas, nenhuma mensagem é persistida.

### Simulador Público

- `create-simulation-link` gera link temporário por token;
- `simulate-client-chat` resolve a conversa pública, registra a resposta do cliente e gera a próxima resposta SDR.

## Testes e Validações

Validação local padrão:

```bash
npm run test
npm run lint
npm run build
```

Smoke completo:

```bash
TEST_USER_EMAIL=seu-usuario-teste@example.com TEST_USER_PASSWORD=sua-senha npm run test:smoke:crm
```

O smoke:

- autentica usuário real;
- prepara um workspace demo;
- cria 100 leads;
- cria 4 campanhas;
- gera 75 conversas operacionais;
- persiste mensagens outbound e inbound;
- cria tokens do simulador.

Cobertura automatizada atual:

- validação segura de env público;
- veredito de conversa e máquina de estado;
- bloqueio de transição por campos obrigatórios;
- utilitários do smoke.

## Limitações Conhecidas

- convites e múltiplos papéis avançados ficaram fora do MVP;
- o kanban usa seletor de etapa em vez de drag and drop;
- exclusão ou arquivamento de leads não foi priorizado;
- a experiência multi-workspace no frontend ainda é mínima;
- o vídeo demonstrativo ainda precisa ser fechado fora do código.

## Checklist Honesto de Entrega

- [x] autenticação
- [x] workspace
- [x] pipeline padrão
- [x] leads
- [x] campos personalizados
- [x] validação por etapa
- [x] campanhas com planejamento por IA
- [x] geração por Edge Function
- [x] envio simulado
- [x] dashboard operacional
- [x] deploy preferencial na Vercel
- [x] uso assistido de stack de vibe coding no frontend
- [ ] vídeo demonstrativo final anexado à entrega
