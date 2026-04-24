# Frontend Review Workflow

## Objetivo

Reintegrar refinamentos vindos de ferramentas de vibe coding sem quebrar a base funcional do repositório.

## Regra Principal

O repositório principal continua sendo a fonte de verdade. Ferramentas como Bolt são apoio de proposta, análise e refinamento, não substituição cega do produto.

## Como Revisar Mudanças

### 1. Conferir a Branch Certa

- trabalhar em branch dedicada de frontend;
- não aplicar mudanças direto em `main`;
- não aceitar alterações em `.env.local`, `.env.example`, `package-lock.json`, Supabase ou Edge Functions sem motivo claro.

### 2. Separar Visual de Lógica

Aceitar com mais liberdade:

- layout;
- estilos;
- composição visual;
- componentes de apresentação.

Revisar com mais rigor:

- chamadas Supabase;
- hooks de dados;
- funções utilitárias;
- lógica de auth;
- lógica de pipeline;
- fluxo do simulador.

### 3. Comparar com a Base Funcional

Antes de aceitar:

- verificar se a tela continua cobrindo o mesmo fluxo;
- verificar se os botões principais continuam existindo;
- verificar se feedbacks e estados continuam presentes;
- verificar se dados reais não foram substituídos por mocks.

### 4. Validar Localmente

Rodar sempre:

- `npm run test`
- `npm run lint`
- `npm run build`

E fazer um smoke manual curto em:

- auth;
- dashboard;
- leads;
- campanhas;
- mensagens IA;
- simulador.

## Quando Rejeitar uma Sugestão

Rejeitar ou adaptar manualmente quando:

- mexer em lógica crítica;
- remover fluxos que sustentam a demo;
- introduzir navegação confusa;
- esconder ações centrais;
- depender de dados fake onde hoje há dados reais;
- alterar dependências sem justificativa.

## Como Manter GitHub como Fonte da Verdade

- trabalhar sempre em branch dedicada;
- revisar diff antes de qualquer commit;
- commitar em blocos pequenos;
- portar melhorias de forma incremental e auditável.

## Resultado Esperado

Melhorar percepção visual e UX do produto sem perder:

- coerência de negócio;
- integridade técnica;
- segurança;
- capacidade de demonstração.
