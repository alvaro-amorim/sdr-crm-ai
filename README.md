<div align="center">

# SDR Expert CRM

### Mini CRM multi-tenant para operação comercial com automações e inteligência artificial

[![Demo](https://img.shields.io/badge/Demo-Acessar-111827?style=for-the-badge&logo=vercel&logoColor=white)](https://sdr-crm-ai-wine.vercel.app/)
[![Video](https://img.shields.io/badge/Vídeo-Apresentação-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/tDCifuSgRc0)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111827)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

</div>

---

## Sobre o projeto

O **SDR Expert CRM** é um produto web para organização da rotina de Sales Development Representatives. A aplicação reúne pipeline comercial, leads, campanhas, mensagens assistidas por IA, histórico de conversas e um simulador público de atendimento.

O projeto foi construído como um MVP funcional, com isolamento por workspace, autenticação real, políticas de acesso no banco e funções server-side para operações sensíveis.

## O que este projeto demonstra

- Aplicação React com TypeScript estruturada para produção.
- Autenticação por e-mail, senha e Google OAuth.
- Arquitetura multi-tenant baseada em workspaces.
- PostgreSQL com Row Level Security.
- Edge Functions para IA e operações privilegiadas.
- Pipeline em kanban e dashboard operacional.
- Testes automatizados e ambiente de avaliação reproduzível.

## Funcionalidades principais

- Cadastro, login, logout e recuperação de senha.
- Criação automática do primeiro workspace.
- CRUD de leads com campos padrão e personalizados.
- Pipeline comercial em kanban.
- Validação de campos obrigatórios por etapa.
- Campanhas com planejamento assistido por IA.
- Geração de mensagens personalizadas por lead.
- Envio simulado com persistência da conversa.
- Simulador público acessado por token.
- Dashboard com métricas e atalhos operacionais.

## Stack

<div align="center">

<img src="https://skillicons.dev/icons?i=react,typescript,vite,supabase,postgres,nodejs,vercel,git,github" alt="Stack do SDR Expert CRM" />

</div>

| Camada | Tecnologias |
|---|---|
| **Front-end** | React 19, TypeScript e Vite |
| **Backend e dados** | Supabase Auth, PostgreSQL, RLS e Edge Functions |
| **IA** | OpenAI para estratégia e geração de mensagens |
| **Validação e testes** | Zod e Vitest |
| **Deploy** | Vercel e Supabase |

## Decisões técnicas

- O Supabase centraliza autenticação, PostgreSQL, RLS e funções server-side para reduzir a superfície operacional do MVP.
- O isolamento por cliente utiliza `workspace_id`, associação de membros e políticas RLS nas tabelas principais.
- Chaves privilegiadas e chamadas de IA permanecem nas Edge Functions, nunca no frontend publicado.
- O frontend valida os principais payloads com Zod antes da persistência.
- O painel de avaliação fica isolado em `/__evaluation`, sem interferir no fluxo normal do produto.

## Edge Functions

- `generate-lead-messages`
- `plan-campaign-strategy`
- `create-simulation-link`
- `simulate-client-chat`
- `generate-evaluation-conversation`

## Segurança e multi-tenancy

- O frontend não utiliza `SUPABASE_SERVICE_ROLE_KEY`.
- Todas as entidades de negócio pertencem a um `workspace_id`.
- O banco valida membership por meio de RLS.
- As Edge Functions verificam autenticação e workspace antes de operar.
- O simulador público limita o acesso a uma thread específica por token.

## Limites honestos do MVP

- O envio de mensagens é simulado e não possui integração real com WhatsApp ou e-mail.
- As permissões avançadas ainda estão limitadas ao modelo de workspace e membership.
- O cenário completo de avaliação pode gerar custo de IA quando utiliza uma chave OpenAI real.

## Executando localmente

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure o ambiente

Use `.env.example` como base:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_ENABLE_EVALUATION_PANEL=false
TEST_USER_EMAIL=avaliador@example.com
TEST_USER_PASSWORD=sua-senha
```

`OPENAI_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` devem permanecer somente no ambiente server-side do Supabase.

### 3. Aplique o projeto Supabase

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

### 4. Publique as funções

```bash
npx supabase functions deploy generate-lead-messages
npx supabase functions deploy plan-campaign-strategy
npx supabase functions deploy create-simulation-link
npx supabase functions deploy simulate-client-chat
npx supabase functions deploy generate-evaluation-conversation
```

### 5. Rode o frontend

```bash
npm run dev
```

## Testes e avaliação

```bash
npm run test
npm run lint
npm run build
```

Para preparar um cenário mínimo sem uso de IA:

```bash
npm run test:smoke:crm
```

Para popular um ambiente completo de demonstração:

```bash
npm run scenario:evaluation:crm
```

O painel auxiliar de avaliação está disponível em:

```text
/__evaluation
```

## Meu papel

Desenvolvimento full stack do projeto, incluindo:

- arquitetura multi-tenant e modelagem de dados;
- interface, dashboard, pipeline e campanhas;
- autenticação, RLS e Edge Functions;
- integração com IA e simulador público;
- testes, seeds técnicos, documentação e deploy.

## Links

- **Aplicação:** https://sdr-crm-ai-wine.vercel.app/
- **Vídeo:** https://youtu.be/tDCifuSgRc0
- **Repositório:** https://github.com/alvaro-amorim/sdr-crm-ai

---

<div align="center">

Desenvolvido por [Álvaro Amorim](https://github.com/alvaro-amorim)

</div>
