## Bloco 5 - Cenário pesado de avaliação

Objetivo desta rodada:

- transformar o seed pesado antigo em um cenário técnico de avaliação;
- manter o volume operacional crível para dashboard, mensagens e simulador;
- separar esse fluxo do smoke test real e leve do CRM.

O que foi consolidado:

- `scripts/evaluation-scenario-lib.mjs`
  - centraliza cenários, distribuição das conversas e métricas esperadas;
- `scripts/evaluation-scenario-lib.test.mjs`
  - valida a sequência e a leitura final de cada cenário;
- `scripts/evaluation-scenario-crm.mjs`
  - cria 100 leads sintéticos;
  - cria 4 campanhas oficiais;
  - persiste até 75 threads com mensagens geradas por IA;
  - deixa o workspace pronto para uma avaliação profunda do produto;
- `supabase/functions/generate-evaluation-conversation/index.ts`
  - passou a refletir a nomenclatura correta do cenário pesado.

Impacto funcional:

- o cenário pesado continua útil para demonstrar volume operacional realista;
- a nomenclatura deixa de chamar esse fluxo de smoke test;
- o produto passa a distinguir claramente:
  - `npm run test:smoke:crm` para seed leve e rápido;
  - `npm run scenario:evaluation:crm` para o seed pesado de avaliação;
  - `/__evaluation` para o painel auxiliar determinístico do avaliador.

Validação executada nesta rodada:

- `npm run test`
- `npm run lint`
- `npm run build`
- `node --check scripts/evaluation-scenario-crm.mjs`
