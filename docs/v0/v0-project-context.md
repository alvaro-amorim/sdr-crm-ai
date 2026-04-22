# v0 Project Context

## Visão geral do produto

O SDR Expert CRM é um mini CRM voltado para equipes de SDR com:

- autenticação Supabase;
- isolamento por workspace;
- gestão de leads em pipeline;
- campanhas com apoio de IA;
- geração de mensagens comerciais;
- envio simulado com persistência de conversa;
- simulador público por token para responder como cliente.

## Contexto de arquitetura

Este repositório é a fonte de verdade funcional.

O uso do v0 daqui para frente deve focar em:

- layout;
- hierarquia visual;
- ergonomia da navegação;
- padronização de componentes;
- refinamento de UX.

O v0 não deve ser tratado como recriação total do produto.

## Stack atual

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

## Fluxo principal

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

## Entidades principais visíveis no frontend

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

## Páginas e superfícies principais

### Auth

Inclui:

- login
- criação de conta
- login com Google
- esqueci a senha
- redefinição de senha

### Dashboard

Inclui:

- métricas principais
- gargalo operacional
- qualidade das conversas
- ações recomendadas
- drill-down por etapa
- atividade recente

### Leads

Inclui:

- formulário de lead
- detalhe do lead em foco
- kanban por etapa
- mudança de etapa com validação

### Campos

Inclui:

- criação de campos customizados
- definição de obrigatoriedade por etapa

### Campanhas

Inclui:

- briefing/contexto
- plano de ação gerado por IA
- revisão do prompt final
- biblioteca de campanhas

### Mensagens IA

Inclui:

- seleção de lead
- seleção de campanha
- geração de mensagens
- contexto operacional
- prévia da conversa
- abertura do simulador público

### Simulador do cliente

Rota pública:

- `/client-simulator?token=...`

Inclui:

- histórico da conversa
- resposta do cliente
- próxima resposta SDR gerada por IA

## Contexto funcional importante para o frontend

- o usuário sempre opera dentro de um workspace;
- campanhas, leads e conversas dependem do workspace atual;
- a IA só funciona corretamente quando lead, campanha e workspace estão coerentes;
- mudança de etapa depende de regras de obrigatoriedade;
- o simulador depende de Edge Functions e token válido.

## Material visual de apoio

Capturas disponíveis em:

- `docs/v0/screenshots/`
