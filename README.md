# SDR Expert CRM

Mini CRM para equipes SDR com autenticação Supabase, isolamento por workspace, kanban de leads, campanhas e geração de mensagens com IA via Edge Function.

## Stack

- React + TypeScript + Vite
- Supabase Auth, Postgres, RLS e Edge Functions
- OpenAI para geração de mensagens
- Zod para validação de ambiente e payload da Edge Function
- Vitest para regras críticas isoladas

## Funcionalidades implementadas

- Cadastro, login e logout com Supabase Auth
- Login com Google OAuth via Supabase
- Recuperacao de senha com link por e-mail
- Criação de workspace inicial com funil padrão
- RLS e filtros por `workspace_id`
- CRUD de leads com campos padrão e responsável opcional
- Campos personalizados por workspace
- Regras de campos obrigatórios por etapa
- Kanban por etapa com bloqueio de movimentação quando faltam campos
- CRUD básico de campanhas
- Edge Function `generate-lead-messages`
- Persistência de mensagens geradas
- Envio simulado com mudança automática para `Tentando Contato`
- Threads de conversa com histórico persistido
- Simulador público por token para agir como cliente e testar a próxima resposta da IA
- Dashboard com total de leads, mensagens e campanhas ativas

## Setup local

1. Instale dependências:

```bash
npm install
```

2. Crie `.env.local` a partir de `.env.example`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

3. Aplique as migrations em ordem:

- `supabase/migrations/20260421150000_initial_schema.sql`
- `supabase/migrations/20260421162000_workspace_bootstrap_and_integrity.sql`
- `supabase/migrations/20260421170000_authenticated_table_grants.sql`
- `supabase/migrations/20260421171500_fix_portuguese_stage_accents.sql`

Para novas migrations, use o CLI local instalado no projeto:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase migration repair 20260421150000 20260421162000 --status applied
npx supabase db push
```

4. Configure Auth no Supabase:

- habilite confirmacao de e-mail para cadastro tradicional
- configure os templates de e-mail usando `docs/supabase-auth-email-templates.md`
- use `https://sdr-crm-ai-wine.vercel.app` como `Site URL` para producao
- adicione `https://sdr-crm-ai-wine.vercel.app`, `http://127.0.0.1:5173` e `http://localhost:5173` nas Redirect URLs
- habilite Google OAuth em `Authentication > Providers > Google`

5. Configure secrets da Edge Function no Supabase:

```bash
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
```

6. Publique as Edge Functions:

```bash
supabase functions deploy generate-lead-messages
supabase functions deploy create-simulation-link
supabase functions deploy simulate-client-chat
supabase functions deploy generate-smoke-conversation
```

7. Rode localmente:

```bash
npm run dev
```

## Deploy na Vercel

- O deploy final obrigatório é a Vercel.
- Configure apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no projeto Vercel.
- `vercel.json` mantém fallback de SPA para rotas diretas como `/client-simulator`.
- `OPENAI_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` ficam somente nos secrets das Supabase Edge Functions.

## Segurança e multi-tenancy

- A chave `SUPABASE_SERVICE_ROLE_KEY` não é usada no frontend.
- Variaveis publicas do frontend devem usar apenas o prefixo `VITE_` quando forem seguras para exposicao no navegador.
- `OPENAI_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` devem ficar apenas no ambiente da Supabase Edge Function.
- Toda tabela funcional possui `workspace_id`.
- RLS valida membership com `is_workspace_member`.
- A criação inicial do workspace usa RPC segura para criar workspace, membership e funil padrão de forma atômica.
- Triggers de integridade bloqueiam referências cruzadas entre workspace, lead, etapa, campanha e campos personalizados.
- A Edge Function valida autenticação, membership, lead e campanha no mesmo workspace antes de chamar o LLM.
- O frontend também filtra todas as consultas pelo workspace atual.

## Geração com IA

O frontend chama apenas a Edge Function `generate-lead-messages` com `workspace_id`, `lead_id` e `campaign_id`. A função busca lead, campanha e campos personalizados no backend, monta o prompt de forma controlada, chama a OpenAI e salva 2 ou 3 variações em `generated_messages`.

O simulador de cliente usa duas funções adicionais:

- `create-simulation-link`: função autenticada que valida membership do workspace e cria um link temporário por token.
- `simulate-client-chat`: função pública limitada pelo token; grava a resposta do cliente e gera a próxima resposta SDR com OpenAI.

A geração possui fallback em cadeia dentro da própria OpenAI:

- tenta primeiro `gpt-4o-mini`
- se houver timeout, indisponibilidade, rate limit, resposta incompleta ou JSON inválido, tenta `gpt-4o`
- se ainda falhar, tenta `gpt-4.1-mini`
- erros de autenticação/autorização da API não fazem fallback, pois indicam secret incorreto ou sem permissão
- nenhuma mensagem é salva no banco se todas as tentativas falharem

## Testes

```bash
npm run test
npm run lint
npm run build
```

Smoke test automatizado do fluxo principal:

```bash
TEST_USER_EMAIL=seu-usuario-teste@example.com TEST_USER_PASSWORD=sua-senha npm run test:smoke:crm
```

O script autentica um usuário de teste, garante um workspace demo, limpa apenas esse workspace, cria 100 leads, 4 campanhas, 75 conversas, mensagens reais geradas pela OpenAI, eventos de envio e tokens de simulador. Quando `OPENAI_API_KEY` existe localmente, o script chama a OpenAI direto; quando não existe, usa a Edge Function autenticada `generate-smoke-conversation` com os secrets remotos do Supabase. A execução segue a estratégia documentada em `docs/smoke-realista-ondas.md`.

Cobertura atual:

- validação segura de variáveis públicas
- geração de `field_key`
- bloqueio de transição por campo padrão ausente
- bloqueio de transição por campo personalizado ausente
- permissão de transição quando todos os campos estão preenchidos

## Limitações conhecidas

- Convites e múltiplos papéis avançados ficaram fora do MVP.
- O kanban usa seletor de etapa em vez de drag and drop para reduzir risco.
- Exclusão/arquivamento de leads não foi priorizado.
- O link de deploy e o link do vídeo devem ser preenchidos após publicação.

## Checklist de entrega

- [x] Auth
- [x] Workspace
- [x] Pipeline padrão
- [x] Leads
- [x] Campos personalizados
- [x] Validação por etapa
- [x] Campanhas
- [x] IA via Edge Function
- [x] Envio simulado
- [x] Dashboard
- [ ] Deploy
- [ ] Vídeo demonstrativo
