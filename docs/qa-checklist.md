# QA Checklist

## Fase atual

Base funcional do MVP criada com frontend React, schema Supabase, RLS, Edge Functions de IA, simulador publico por token e seeds tecnicos separados por finalidade.

## Testes automatizados

- `npm run test`
  - valida utilitarios, regras puras e leitura de cenarios;
- `npm run test:smoke:crm`
  - autentica um usuario real de teste;
  - cria ou reutiliza um workspace leve e reexecutavel;
  - limpa apenas os dados do workspace do smoke;
  - cria 3 leads fixos, 1 campanha fixa e 1 conversa seeded sem IA;
  - deixa o app pronto para navegacao minima do avaliador;
- `npm run scenario:evaluation:crm`
  - autentica um usuario real de teste;
  - cria ou reutiliza um workspace pesado de avaliacao;
  - cria 100 leads, 4 campanhas e ate 75 conversas com IA real;
  - persiste `conversation_threads`, `conversation_messages`, `generated_messages`, `sent_message_events` e tokens do simulador.

## Convencao dos seeds

### Smoke real

- usa um workspace leve dedicado;
- nome padrao: `Operacao SDR Smoke`;
- nao depende de IA;
- serve para subir um ambiente minimo e rapido.

### Cenario de avaliacao

- usa um workspace pesado dedicado;
- nome padrao: `Operacao SDR Avaliacao`;
- pode usar OpenAI local ou a Edge Function autenticada `generate-evaluation-conversation`;
- serve para avaliacao tecnica com volume operacional alto.

## Variaveis locais

Minimo obrigatorio:

- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`

Opcionais do smoke leve:

- `SMOKE_WORKSPACE_NAME`
- `SMOKE_PUBLIC_BASE_URL`

Opcionais do cenario pesado:

- `OPENAI_API_KEY`
- `EVALUATION_WORKSPACE_NAME`
- `EVALUATION_PUBLIC_BASE_URL`
- `EVALUATION_WAVE`
- `EVALUATION_THREAD_LIMIT`
- `EVALUATION_AI_DELAY_MS`

## Testes manuais previstos

1. Auth
   - criar conta;
   - validar login tradicional;
   - validar Google OAuth;
   - validar recuperacao de senha.
2. Workspace
   - criar workspace;
   - confirmar funil padrao e membership do owner.
3. Leads
   - criar e editar lead;
   - validar campos personalizados.
4. Pipeline
   - validar bloqueio por obrigatoriedade;
   - validar mudanca de etapa.
5. Campanhas e IA
   - criar campanha;
   - gerar mensagens;
   - validar envio simulado.
6. Dashboard
   - validar contagens reais por etapa;
   - validar estados vazios.
7. Simulador do cliente
   - abrir o link do simulador;
   - responder como cliente;
   - validar persistencia da conversa.

## Revisao de seguranca

- `.env*` ignorados no Git;
- `.env.example` sem segredos reais;
- service role restrita a Edge Functions;
- RLS ativa nas tabelas principais;
- simulador publico limitado a thread especifica por token;
- seeds limpam apenas o workspace dedicado e nao tocam outros workspaces.
