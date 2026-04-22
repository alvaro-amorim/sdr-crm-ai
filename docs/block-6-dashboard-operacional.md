# Bloco 6 - Dashboard operacional clicavel

## Objetivo

Transformar o dashboard em um cockpit de operacao mais acionavel, mantendo as metricas reais ja separadas entre envios do SDR e respostas do cliente.

## Implementado

- Adicionado painel de atalhos operacionais clicaveis no dashboard:
  - Leads sem resposta.
  - Follow-up secundario pendente.
  - Recusas recentes.
  - Conversas positivas.
  - Leads em qualificacao.
  - Reunioes sinalizadas.
  - Campanhas mais ativas.
  - Risco de perda.
- Cada atalho abre um drill-down sobreposto com:
  - total da categoria;
  - quantidade de campanhas envolvidas;
  - etapa predominante;
  - acao recomendada;
  - previa da conversa;
  - lista dos leads com empresa, cargo, etapa, campanha, status da conversa e ultima interacao.
- As categorias usam dados reais carregados no front-end:
  - `conversation_threads`;
  - `conversation_messages`;
  - `sent_message_events`;
  - `leads`;
  - `campaigns`;
  - `pipeline_stages`.
- O painel permanece responsivo, com cards e drill-down adaptando para mobile.

## Regras preservadas

- Nenhuma metrica inventada foi adicionada.
- Respostas simuladas do cliente continuam separadas dos envios outbound do SDR.
- Nenhuma migration foi necessaria.
- Nenhum segredo ou chave foi exposto.

## Validacao esperada

- `npm run test`
- `npm run lint`
- `npm run build`

