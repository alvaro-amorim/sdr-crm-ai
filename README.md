# SDR Expert CRM

Mini CRM para operacao de SDR com Supabase Auth, isolamento por workspace, pipeline comercial, campanhas com apoio de IA e simulador publico de conversa.

## Stack

- React 19 + TypeScript + Vite
- Supabase Auth, Postgres, RLS e Edge Functions
- OpenAI para planejamento e geracao de mensagens
- Zod para validacao
- Vitest para testes automatizados
- Vercel para deploy do frontend

## Fluxo principal entregue

- cadastro, login, logout e recuperacao de senha com Supabase Auth;
- login com Google via Supabase OAuth;
- criacao do primeiro workspace com funil padrao;
- CRUD de leads com campos padrao e personalizados;
- validacao de campos obrigatorios por etapa;
- leitura do pipeline em kanban;
- criacao de campanhas com planejamento assistido por IA;
- geracao de mensagens por lead;
- envio simulado com persistencia de thread;
- simulador publico por token;
- dashboard operacional com metricas e atalhos.

## Edge Functions ativas

- `generate-lead-messages`
- `plan-campaign-strategy`
- `create-simulation-link`
- `simulate-client-chat`
- `generate-evaluation-conversation`

## Setup local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar `.env.local`

Use `.env.example` como base:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
TEST_USER_EMAIL=avaliador@example.com
TEST_USER_PASSWORD=sua-senha
```

`OPENAI_API_KEY` local e opcional e so deve ser usada no cenario pesado de avaliacao. Ela nunca deve ficar no frontend publicado.

### 3. Linkar e aplicar o projeto Supabase

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

### 4. Publicar as Edge Functions

```bash
npx supabase functions deploy generate-lead-messages
npx supabase functions deploy plan-campaign-strategy
npx supabase functions deploy create-simulation-link
npx supabase functions deploy simulate-client-chat
npx supabase functions deploy generate-evaluation-conversation
```

### 5. Rodar o frontend local

```bash
npm run dev
```

## Seeds tecnicos

O repositorio agora separa claramente dois fluxos:

### Smoke test real

Comando:

```bash
npm run test:smoke:crm
```

Objetivo:

- preparar um ambiente minimo e rapido;
- nao usar IA;
- criar apenas:
  - 3 leads fixos
  - 1 campanha fixa
  - 1 conversa seeded
  - 1 token de simulador

Uso recomendado:

- deixar o sistema minimamente pronto para avaliacao;
- validar o fluxo principal sem volume alto;
- testar rapidamente em um perfil vazio.

Variaveis opcionais:

- `SMOKE_WORKSPACE_NAME`
- `SMOKE_PUBLIC_BASE_URL`

### Cenario pesado de avaliacao

Comando:

```bash
npm run scenario:evaluation:crm
```

Objetivo:

- preparar um workspace cheio e crivel para demo;
- criar 100 leads e 4 campanhas;
- gerar ate 75 conversas com IA real;
- povoar dashboard, mensagens e simulador com volume alto.

Esse fluxo nao e mais tratado como smoke test.

Variaveis opcionais:

- `OPENAI_API_KEY`
- `EVALUATION_WORKSPACE_NAME`
- `EVALUATION_PUBLIC_BASE_URL`
- `EVALUATION_WAVE`
- `EVALUATION_THREAD_LIMIT`
- `EVALUATION_AI_DELAY_MS`

## Testes e validacoes

```bash
npm run test
npm run lint
npm run build
```

Smoke leve:

```bash
npm run test:smoke:crm
```

Cenario pesado:

```bash
npm run scenario:evaluation:crm
```

## Deploy

- frontend publicado na Vercel;
- variaveis publicas na Vercel:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` ficam apenas no Supabase.

Deploy de referencia:

- `https://sdr-crm-ai-wine.vercel.app`

## Seguranca e multi-tenancy

- o frontend nao usa `SUPABASE_SERVICE_ROLE_KEY`;
- toda entidade de negocio e ligada a `workspace_id`;
- o banco aplica membership e RLS nas tabelas principais;
- as Edge Functions validam autenticacao e workspace antes de operar;
- o simulador publico acessa apenas uma thread especifica por token.
