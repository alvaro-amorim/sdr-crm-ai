# Smoke realista em duas ondas

Este projeto usa `npm run test:smoke:crm` como seed operacional e validação ponta a ponta do CRM. O script foi desenhado para um perfil zerado de avaliação e recria um workspace completo, com volume suficiente para visualizar o produto como se estivesse em operação.

## Objetivo

- Criar um workspace demonstrável sem dados reais de clientes.
- Popular 100 leads sintéticos plausíveis, com nomes, empresas, cargos, canais e campos comerciais.
- Criar 4 campanhas oficiais do fluxo SDR.
- Gerar conversas reais com OpenAI, em vez de textos fixos escritos no script.
- Persistir mensagens geradas, eventos simulados, threads de conversa e tokens de simulador.
- Abrir uma janela pública limitada por token para agir como cliente e testar a próxima resposta da IA.

## Ondas

### Onda 1

- Cria as primeiras 35 conversas.
- Cada conversa recebe 3 mensagens geradas por IA.
- O foco é volume inicial para dashboard, campanhas e mensagens.
- Cenários incluem interesse positivo, respostas neutras, objeções leves e pedidos de material.

### Onda 2

- Cria mais 40 conversas, totalizando 75 threads.
- Cada conversa recebe 4 mensagens geradas por IA.
- O foco é profundidade operacional, com respostas adicionais do cliente e follow-up do SDR.
- O resultado esperado fica entre 220 e 320 mensagens de conversa persistidas.

## Campanhas criadas

1. `Outbound ICP Operações e Revenue`
2. `Reativação de pipeline parado`
3. `Qualificação para diagnóstico comercial`
4. `Avanço para reunião`

## Variáveis locais

O smoke exige autenticação real no Supabase. A chave OpenAI local é opcional:

```bash
TEST_USER_EMAIL=avaliador@example.com
TEST_USER_PASSWORD=sua-senha
OPENAI_API_KEY=sua-chave-openai
SMOKE_WORKSPACE_NAME=Operação SDR Demo
SMOKE_PUBLIC_BASE_URL=https://sdr-crm-ai-wine.vercel.app
SMOKE_WAVE=all
SMOKE_THREAD_LIMIT=75
SMOKE_AI_DELAY_MS=500
```

`OPENAI_API_KEY` não deve ser configurada na Vercel do frontend. Em produção, a chave deve existir apenas como secret das Supabase Edge Functions. Se a chave não existir localmente, o smoke usa a função autenticada `generate-smoke-conversation`, que chama a OpenAI com os secrets remotos do Supabase e retorna conversas reais para o script persistir.

## Execução

```bash
npm run test:smoke:crm
```

O script é reexecutável: ele limpa somente os dados do workspace informado em `SMOKE_WORKSPACE_NAME`, preservando outros workspaces do mesmo projeto.

## Validações feitas pelo script

- 100 leads criados.
- 4 campanhas criadas.
- 75 threads de conversa quando `SMOKE_WAVE=all`.
- Pelo menos 220 mensagens de conversa quando a Onda 2 está ativa.
- Tokens de simulador criados para todas as threads.
- Eventos de envio simulados persistidos em `sent_message_events`.
- Mensagens outbound persistidas também em `generated_messages`.
- Respostas da IA que violem a sequência obrigatória do cenário são descartadas e geradas novamente antes de abortar o smoke.
- Os metadados `direction` e `sender_name` são normalizados conforme a sequência do cenário antes da persistência, evitando que uma marcação incorreta da IA quebre as métricas operacionais.
- A validação final compara nomes de etapa de forma normalizada, aceitando diferenças de acentuação entre schema antigo e schema atual.

## Simulador do cliente

A tela `Mensagens IA` mostra uma prévia da conversa e um atalho para abrir o simulador em uma janela separada. O link é gerado por `create-simulation-link` e contém um token temporário de 14 dias. A janela pública chama `simulate-client-chat`, grava a resposta do cliente e gera a próxima resposta do SDR com OpenAI e fallback.

Esse fluxo permite que o avaliador teste a experiência como cliente sem precisar criar outro usuário ou acessar o workspace interno.
