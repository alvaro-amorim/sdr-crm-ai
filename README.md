# SDR Expert CRM

Mini CRM para operação de SDR com Supabase Auth, isolamento por workspace, pipeline comercial, campanhas com apoio de IA e simulador público de conversa.

## Entrega final

- Aplicação publicada: [https://sdr-crm-ai-wine.vercel.app/](https://sdr-crm-ai-wine.vercel.app/)
- Repositório GitHub: [https://github.com/alvaro-amorim/sdr-crm-ai](https://github.com/alvaro-amorim/sdr-crm-ai)
- Vídeo de apresentação: [https://youtu.be/tDCifuSgRc0](https://youtu.be/tDCifuSgRc0)
- Branch de entrega: `main`

## Stack

- React 19 + TypeScript + Vite
- Supabase Auth, Postgres, RLS e Edge Functions
- OpenAI para planejamento e geração de mensagens
- Zod para validação
- Vitest para testes automatizados
- Vercel para deploy do frontend

## Fluxo principal entregue

- cadastro, login, logout e recuperação de senha com Supabase Auth;
- login com Google via Supabase OAuth;
- criação do primeiro workspace com funil padrão;
- CRUD de leads com campos padrão e personalizados;
- validação de campos obrigatórios por etapa;
- leitura do pipeline em kanban;
- criação de campanhas com planejamento assistido por IA;
- geração de mensagens por lead;
- envio simulado com persistência de thread;
- simulador público por token;
- dashboard operacional com métricas e atalhos.

## Decisões técnicas

- Supabase centraliza Auth, Postgres, RLS e Edge Functions para reduzir superfície operacional no MVP.
- O isolamento multi-tenant usa `workspace_id`, `workspace_members` e políticas RLS nas tabelas principais.
- As chamadas com privilégio e IA ficam em Edge Functions, mantendo `SUPABASE_SERVICE_ROLE_KEY` e `OPENAI_API_KEY` fora do frontend.
- O frontend usa React, TypeScript e validações locais com Zod para reduzir estados inválidos antes de persistir dados.
- O painel auxiliar de avaliação fica separado em `/__evaluation` para não misturar dados de demo com o fluxo normal do produto.

## Diferenciais implementados

- Workspace inicial com funil padrão pronto para uso.
- Campo textual `technical_owner_name` para responsável técnico quando não existe usuário interno atribuído.
- Campo `assigned_user_id` preservado para atribuição real a membros do workspace.
- Geração de campanhas e mensagens com IA via Edge Functions.
- Envio simulado com persistência de conversa e simulador público por token.
- Painel técnico de avaliação e smoke leve para preparar rapidamente um ambiente testável.

## Limites honestos do MVP

- O envio de mensagens é simulado; não há integração real com WhatsApp, e-mail ou CRM externo.
- O painel auxiliar existe para avaliação técnica e deve ficar restrito por configuração em ambientes públicos.
- O cenário pesado de avaliação pode gerar custo de IA e depende de `OPENAI_API_KEY` configurada no ambiente correto.
- Permissões avançadas por perfil ainda estão reduzidas ao modelo de workspace e membership.

## Edge Functions ativas

- `generate-lead-messages`
- `plan-campaign-strategy`
- `create-simulation-link`
- `simulate-client-chat`
- `generate-evaluation-conversation`

## Setup local

### 1. Instalar dependências

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

`OPENAI_API_KEY` local é opcional e só deve ser usada no cenário pesado de avaliação. Ela nunca deve ficar no frontend publicado.

`VITE_ENABLE_EVALUATION_PANEL` é opcional. Use `true` apenas quando for necessário expor o painel auxiliar de avaliação em ambiente remoto de review.

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

## Seeds técnicos

O repositório agora separa claramente dois fluxos:

### Painel auxiliar de avaliação técnica

Rota:

```bash
/__evaluation
```

Objetivo:

- acelerar a validação funcional pelo avaliador;
- não misturar seeds de apoio com o fluxo normal do produto;
- popular dados determinísticos no workspace atual da sessão do avaliador.

Comportamento:

- usa o workspace logado do avaliador, inclusive quando aberto por `?workspace=`;
- funciona automaticamente em `localhost`;
- em ambiente remoto exige `VITE_ENABLE_EVALUATION_PANEL=true`;
- oferece 4 ações determinísticas:
  - gerar leads de exemplo
  - criar campanha de exemplo
  - popular cenário básico de avaliação
  - resetar dados de avaliação
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

- preparar um ambiente mínimo e rápido;
- não usar IA;
- criar apenas:
  - 3 leads fixos
  - 1 campanha fixa
  - 1 conversa seeded
  - 1 token de simulador

Uso recomendado:

- deixar o sistema minimamente pronto para avaliação;
- validar o fluxo principal sem volume alto;
- testar rapidamente em um perfil vazio.

Variáveis opcionais:

- `SMOKE_WORKSPACE_NAME`
- `SMOKE_PUBLIC_BASE_URL`

### Cenário pesado de avaliação

Comando:

```bash
npm run scenario:evaluation:crm
```

Objetivo:

- preparar um workspace cheio e crível para demo;
- criar 100 leads e 4 campanhas;
- gerar até 75 conversas com IA real;
- povoar dashboard, mensagens e simulador com volume alto.

Esse fluxo não é mais tratado como smoke test.

Variáveis opcionais:

- `OPENAI_API_KEY`
- `EVALUATION_WORKSPACE_NAME`
- `EVALUATION_PUBLIC_BASE_URL`
- `EVALUATION_WAVE`
- `EVALUATION_THREAD_LIMIT`
- `EVALUATION_AI_DELAY_MS`

## Testes e validações

```bash
npm run test
npm run lint
npm run build
```

Smoke leve:

```bash
npm run test:smoke:crm
```

Cenário pesado:

```bash
npm run scenario:evaluation:crm
```

Painel auxiliar:

- abrir `http://localhost:5173/__evaluation`
- preparar o cenário com um clique
- navegar pelos atalhos do app principal no workspace atual da sessão

## Guia rápido para o avaliador

1. Acesse a aplicação publicada ou rode o projeto localmente.
2. Crie uma conta ou entre com o usuário de teste fornecido fora do repositório.
3. Confirme a criação do workspace inicial.
4. Abra `/__evaluation` e prepare o cenário básico.
5. Navegue por Dashboard, Leads, Campanhas, Mensagens IA e Simulador.
6. Opcionalmente rode `npm run test:smoke:crm` para validar o fluxo mínimo automatizado.

Vídeo de apresentação:

- [https://youtu.be/tDCifuSgRc0](https://youtu.be/tDCifuSgRc0)

## Deploy

- frontend publicado na Vercel;
- variáveis públicas na Vercel:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_ENABLE_EVALUATION_PANEL=true` para expor o painel remoto do avaliador
- `OPENAI_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` ficam apenas no Supabase.

Deploy de referência:

- [https://sdr-crm-ai-wine.vercel.app/](https://sdr-crm-ai-wine.vercel.app/)

## Segurança e multi-tenancy

- o frontend não usa `SUPABASE_SERVICE_ROLE_KEY`;
- toda entidade de negócio é ligada a `workspace_id`;
- o banco aplica membership e RLS nas tabelas principais;
- as Edge Functions validam autenticação e workspace antes de operar;
- o simulador público acessa apenas uma thread específica por token.
