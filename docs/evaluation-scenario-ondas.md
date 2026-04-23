# Cenario pesado de avaliacao em duas ondas

Este documento descreve o seed pesado de avaliacao do CRM:

```bash
npm run scenario:evaluation:crm
```

Ele nao e o smoke test real do projeto. O objetivo aqui e preparar um workspace com volume operacional alto para uma avaliacao mais profunda.

## Objetivo

- criar um workspace demonstravel com volume operacional crivel;
- popular 100 leads sinteticos;
- criar 4 campanhas oficiais do fluxo SDR;
- gerar ate 75 conversas com IA real;
- persistir mensagens, eventos, threads e tokens do simulador.

## Ondas

### Onda 1

- prioriza leads sem resposta e follow-up secundario;
- deixa o dashboard com volume real de cadencia aberta.

### Onda 2

- aprofunda os estados de recusa, interesse, qualificacao e reuniao;
- aumenta a leitura operacional de mensagens e simulador.

## Variaveis locais

```bash
TEST_USER_EMAIL=avaliador@example.com
TEST_USER_PASSWORD=sua-senha
OPENAI_API_KEY=sua-chave-openai
EVALUATION_WORKSPACE_NAME=Operacao SDR Avaliacao
EVALUATION_PUBLIC_BASE_URL=https://sdr-crm-ai-wine.vercel.app
EVALUATION_WAVE=all
EVALUATION_THREAD_LIMIT=75
EVALUATION_AI_DELAY_MS=500
```

`OPENAI_API_KEY` local e opcional. Se ela nao existir, o script usa a Edge Function autenticada `generate-evaluation-conversation`, que executa a geracao com os secrets remotos do Supabase.

## Validacoes do script

- 100 leads criados;
- 4 campanhas criadas;
- distribuicao coerente por cenario;
- total esperado de threads, mensagens e eventos;
- token de simulador para cada thread;
- validacao da sequencia obrigatoria de cada conversa.

## Quando usar

Use esse comando quando o objetivo for:
- deixar o workspace visualmente cheio para demo;
- validar dashboards, mensagens e simulador com volume alto;
- testar uma apresentacao tecnica mais completa.

Se o objetivo for apenas preparar um ambiente minimo e rapido, use o smoke real:

```bash
npm run test:smoke:crm
```
