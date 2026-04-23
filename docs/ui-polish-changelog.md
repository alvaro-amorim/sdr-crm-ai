# UI Polish Changelog

## 2026-04-21 - Base de polish

- dashboard recebeu leitura executiva mais forte;
- leads, campanhas, campos e mensagens ganharam hierarquia visual melhor;
- auth e onboarding inicial foram refinados;
- modais e overlays passaram por padronizacao visual.

Validacoes recorrentes desta fase:

- `npm run test`
- `npm run lint`
- `npm run build`
- `npm run test:smoke:crm`

## 2026-04-21 - Cenario pesado de avaliacao

- o seed pesado deixou de ser tratado como smoke test;
- o fluxo antigo foi renomeado para:
  - `scripts/evaluation-scenario-crm.mjs`
  - `scripts/evaluation-scenario-lib.mjs`
  - `scripts/evaluation-scenario-lib.test.mjs`
  - `supabase/functions/generate-evaluation-conversation`
  - `docs/evaluation-scenario-ondas.md`
- esse fluxo continua responsavel por criar volume alto de demonstracao com IA real.

## 2026-04-23 - Smoke real do CRM

- criado `scripts/smoke-crm.mjs` como smoke real, leve e deterministico;
- o comando `npm run test:smoke:crm` passou a preparar:
  - 3 leads fixos
  - 1 campanha fixa
  - 1 conversa seeded
  - 1 token de simulador
- o objetivo agora e deixar o ambiente minimamente pronto para avaliacao rapida sem depender de IA.

## 2026-04-23 - Nomenclatura tecnica corrigida

- o termo `smoke test` foi reservado ao fluxo leve;
- o fluxo pesado passou a ser documentado como `cenario de avaliacao`;
- docs e scripts principais foram alinhados a essa separacao;
- nomes historicos de migration com `smoke` foram mantidos apenas por compatibilidade de historico.
