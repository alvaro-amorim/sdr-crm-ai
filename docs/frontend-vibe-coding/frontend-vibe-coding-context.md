# Frontend Vibe Coding Context

## Visão Geral do Produto

O SDR Expert CRM é um mini CRM para equipes de SDR com:

- autenticação Supabase;
- isolamento por workspace;
- gestão de leads em pipeline;
- campanhas com apoio de IA;
- geração de mensagens comerciais;
- envio simulado com persistência de conversa;
- simulador público por token para responder como cliente.

## Direção Técnica

Este repositório é a fonte de verdade funcional.

Ferramentas de vibe coding, incluindo Bolt, podem apoiar:

- leitura da estrutura visual;
- propostas de UX;
- refinamento de layout;
- hierarquia visual;
- ergonomia da navegação;
- consistência de componentes.

Elas não devem ser tratadas como substituição total da base funcional. Toda saída precisa voltar por diff revisável, validação local e commit claro.

## Stack Atual

- React 19
- TypeScript
- Vite
- Supabase Auth
- Supabase Postgres
- RLS
- Supabase Edge Functions
- OpenAI
- Zod
- Vitest

## Fluxo Principal

1. usuário autentica;
2. entra ou cria workspace;
3. vê o dashboard;
4. cria e qualifica leads;
5. ajusta campos e regras por etapa;
6. cria campanha com apoio de IA;
7. gera mensagens por lead;
8. registra envio simulado;
9. abre o simulador do cliente;
10. acompanha a conversa e o avanço do funil.

## Entidades Visíveis no Frontend

- workspace
- workspace member
- pipeline stage
- lead
- workspace custom field
- stage required field
- campaign
- generated message
- sent message event
- conversation thread
- conversation message

## Superfícies Principais

### Auth

Login, criação de conta, login com Google, esqueci a senha e redefinição de senha.

### Dashboard

Métricas principais, gargalo operacional, qualidade das conversas, ações recomendadas, drill-down por etapa e atividade recente.

### Leads

Formulário de lead, detalhe do lead em foco, kanban por etapa e mudança de etapa com validação.

### Campos

Criação de campos customizados e definição de obrigatoriedade por etapa.

### Campanhas

Briefing, plano de ação gerado por IA, revisão do prompt final e biblioteca de campanhas.

### Mensagens IA

Seleção de lead, seleção de campanha, geração de mensagens, contexto operacional, prévia da conversa e abertura do simulador público.

### Simulador do Cliente

Rota pública `/client-simulator?token=...` com histórico da conversa, resposta do cliente e próxima resposta SDR gerada por IA.

## Material Visual de Apoio

Capturas disponíveis em:

- `docs/frontend-vibe-coding/screenshots/`
