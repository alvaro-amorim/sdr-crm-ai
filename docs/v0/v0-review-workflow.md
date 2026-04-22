# v0 Review Workflow

## Objetivo

Reintegrar refinamentos vindos do v0 sem quebrar a base funcional do repositório.

## Regra principal

O repositório principal continua sendo a fonte de verdade.  
O v0 é uma ferramenta de proposta e refinamento, não de substituição cega.

## Como revisar o que vier do v0

### 1. Conferir a branch certa

- confirmar que o trabalho está na branch de frontend v0;
- não revisar nem aplicar mudanças direto em `main`.

### 2. Separar visual de lógica

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

### 3. Comparar com a base funcional

Antes de aceitar:

- verificar se a tela continua cobrindo o mesmo fluxo;
- verificar se os botões principais continuam existindo;
- verificar se feedbacks e estados continuam presentes.

### 4. Validar localmente

Rodar sempre:

- `npm run test`
- `npm run lint`
- `npm run build`

E fazer um smoke manual curto em:

- auth
- dashboard
- leads
- campanhas
- mensagens IA
- simulador

## Quando rejeitar uma sugestão do v0

Rejeitar ou adaptar manualmente quando:

- mexer em lógica crítica;
- remover fluxos que sustentam a demo;
- introduzir navegação confusa;
- esconder ações centrais;
- depender de dados fake onde hoje há dados reais.

## Como manter GitHub como fonte da verdade

- trabalhar sempre em branch dedicada;
- revisar diff antes de qualquer commit;
- commitar em blocos pequenos;
- não usar o v0 como origem única do código final;
- portar para o repositório principal de forma incremental e auditável.

## Resultado esperado

Melhorar a percepção visual e a UX do produto sem perder:

- coerência de negócio;
- integridade técnica;
- segurança;
- capacidade de demonstração.
