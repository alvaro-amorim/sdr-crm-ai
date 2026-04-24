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

## Decisoes tecnicas

- Supabase centraliza Auth, Postgres, RLS e Edge Functions para reduzir superficie operacional no MVP.
- O isolamento multi-tenant usa `workspace_id`, `workspace_members` e politicas RLS nas tabelas principais.
- As chamadas com privilegio e IA ficam em Edge Functions, mantendo `SUPABASE_SERVICE_ROLE_KEY` e `OPENAI_API_KEY` fora do frontend.
- O frontend usa React, TypeScript e validacoes locais com Zod para reduzir estados invalidos antes de persistir dados.
- O painel auxiliar de avaliacao fica separado em `/__evaluation` para nao misturar dados de demo com o fluxo normal do produto.

## Diferenciais implementados

- Workspace inicial com funil padrao pronto para uso.
- Campo textual `technical_owner_name` para responsavel tecnico quando nao existe usuario interno atribuido.
- Campo `assigned_user_id` preservado para atribuicao real a membros do workspace.
- Geracao de campanhas e mensagens com IA via Edge Functions.
- Envio simulado com persistencia de conversa e simulador publico por token.
- Painel tecnico de avaliacao e smoke leve para preparar rapidamente um ambiente testavel.

## Limites honestos do MVP

- O envio de mensagens e simulado; nao ha integracao real com WhatsApp, e-mail ou CRM externo.
- O painel auxiliar existe para avaliacao tecnica e deve ficar restrito por configuracao em ambientes publicos.
- O cenario pesado de avaliacao pode gerar custo de IA e depende de `OPENAI_API_KEY` configurada no ambiente correto.
- Permissoes avancadas por perfil ainda estao reduzidas ao modelo de workspace e membership.

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
VITE_ENABLE_EVALUATION_PANEL=false
TEST_USER_EMAIL=avaliador@example.com
TEST_USER_PASSWORD=sua-senha
```

`OPENAI_API_KEY` local e opcional e so deve ser usada no cenario pesado de avaliacao. Ela nunca deve ficar no frontend publicado.

`VITE_ENABLE_EVALUATION_PANEL` e opcional. Use `true` apenas quando for necessario expor o painel auxiliar de avaliacao em ambiente remoto de review.

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

### Painel auxiliar de avaliacao tecnica

Rota:

```bash
/__evaluation
```

Objetivo:

- acelerar a validacao funcional pelo avaliador;
- nao misturar seeds de apoio com o fluxo normal do produto;
- popular dados deterministicos no workspace atual da sessao do avaliador.

Comportamento:

- usa o workspace logado do avaliador, inclusive quando aberto por `?workspace=`;
- funciona automaticamente em `localhost`;
- em ambiente remoto exige `VITE_ENABLE_EVALUATION_PANEL=true`;
- oferece 4 acoes deterministicas:
  - gerar leads de exemplo
  - criar campanha de exemplo
  - popular cenario basico de avaliacao
  - resetar dados de avaliacao
- expõe atalhos diretos para:
  - Dashboard
  - Leads
  - Campanhas
  - Mensagens IA
  - chat como cliente quando a conversa seeded existir

Mais detalhes:

- `docs/evaluation-panel.md`

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

Painel auxiliar:

- abrir `http://localhost:5173/__evaluation`
- preparar o cenario com um clique
- navegar pelos atalhos do app principal no workspace atual da sessao

## Guia rapido para o avaliador

1. Acesse o deploy de referencia ou rode o projeto localmente.
2. Crie uma conta ou entre com o usuario de teste fornecido fora do repositorio.
3. Confirme a criacao do workspace inicial.
4. Abra `/__evaluation` e prepare o cenario basico.
5. Navegue por Dashboard, Leads, Campanhas, Mensagens IA e Simulador.
6. Opcionalmente rode `npm run test:smoke:crm` para validar o fluxo minimo automatizado.

Video de apresentacao:

- Link: pendente

## Deploy

- frontend publicado na Vercel;
- variaveis publicas na Vercel:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_ENABLE_EVALUATION_PANEL=true` para expor o painel remoto do avaliador
- `OPENAI_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` ficam apenas no Supabase.

Deploy de referencia:

- `https://sdr-crm-ai-wine.vercel.app`

## Seguranca e multi-tenancy

- o frontend nao usa `SUPABASE_SERVICE_ROLE_KEY`;
- toda entidade de negocio e ligada a `workspace_id`;
- o banco aplica membership e RLS nas tabelas principais;
- as Edge Functions validam autenticacao e workspace antes de operar;
- o simulador publico acessa apenas uma thread especifica por token.
