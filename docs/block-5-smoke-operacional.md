## Bloco 5 - Smoke test operacional realista

Objetivo desta rodada:
- reescrever o smoke para semear estados operacionais criveis;
- garantir cadencia com abertura sem resposta e abordagem secundaria sem resposta;
- impedir sequencias falsas, como duas abordagens frias seguidas;
- validar contagens exatas de outbound, inbound, generated messages e threads.

O que foi alterado:
- criei `scripts/smoke-flow-lib.mjs` para centralizar:
  - cenarios do smoke;
  - distribuicao das conversas;
  - metricas esperadas;
  - validacao de sequencia por cenario;
- adicionei teste automatizado em `scripts/smoke-flow-lib.test.mjs`;
- reescrevi `scripts/smoke-crm-flow.mjs` para criar cenarios reais:
  - `opening_no_response`
  - `secondary_follow_up_no_response`
  - `negative_closed`
  - `interested_follow_up`
  - `qualified_multi_touch`
  - `meeting_confirmed`
- cada cenario agora define:
  - campanha usada;
  - sequencia obrigatoria de mensagens;
  - `prompt_purpose` esperado;
  - status final do thread;
  - sentimento final;
  - etapa final do lead;
- o script passou a validar no fim:
  - total exato de threads;
  - total exato de mensagens geradas;
  - total exato de eventos;
  - total exato de mensagens de conversa;
  - token de simulador por thread;
  - sequencia e `prompt_purpose` das mensagens persistidas;
  - etapa final e status final de cada thread.

Fallback remoto:
- atualizei a Edge Function `supabase/functions/generate-smoke-conversation/index.ts` para aceitar `scenario_profile`;
- o fallback remoto agora respeita a mesma sequencia obrigatoria do script local.

Impacto funcional:
- o smoke deixa de gerar conversa generica por "onda" e passa a montar operacao crivel;
- o dashboard vai receber volume real de:
  - leads sem resposta;
  - follow-up secundario;
  - recusas encerradas;
  - conversas em qualificacao;
  - reunioes encaminhadas.

Migracoes:
- nenhuma migration foi necessaria neste bloco;
- as alteracoes foram de script, validacao e fallback na Edge Function.

Validacao executada:
- `npm run test`
- `npm run lint`
- `npm run build`
- `node --check scripts/smoke-crm-flow.mjs`
