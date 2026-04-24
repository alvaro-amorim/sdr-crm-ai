# Bloco 8 - Polimento final antes do refinamento do frontend

## Objetivo

Fechar a base atual do CRM antes da etapa final de refinamento visual, com microcopy consistente e um roteiro claro para validacao tecnica.

## Alteracoes

- corrigida a acentuacao visivel do fluxo de campanha em duas etapas;
- padronizadas mensagens de erro e dicas do formulario de campanha;
- mantida a regra operacional: a OpenAI continua restrita as Edge Functions e ao cenario pesado de avaliacao local, sem exposicao no frontend.

## Validacao antes do seed final de avaliacao

Antes de rodar o seed pesado em um perfil limpo, atualize o `.env.local` com:

```bash
TEST_USER_EMAIL=email-limpo-de-avaliacao@example.com
TEST_USER_PASSWORD=senha-do-usuario-limpo
EVALUATION_WORKSPACE_NAME=Operacao SDR Avaliacao
EVALUATION_PUBLIC_BASE_URL=https://sdr-crm-ai-wine.vercel.app
EVALUATION_WAVE=all
EVALUATION_THREAD_LIMIT=75
EVALUATION_AI_DELAY_MS=500
```

## Proximo passo

Para o seed pesado:

```bash
npm run scenario:evaluation:crm
```

Para o smoke rapido e leve:

```bash
npm run test:smoke:crm
```
