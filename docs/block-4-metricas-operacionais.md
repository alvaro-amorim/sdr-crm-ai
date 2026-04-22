## Bloco 4 - Metricas operacionais confiaveis

Objetivo desta rodada:
- separar contagem de envios do SDR e respostas do cliente;
- impedir que o dashboard misture eventos outbound e inbound;
- alinhar a narrativa operacional com o historico conversacional real.

O que foi alterado:
- o dashboard passou a calcular `realOutboundCount` e `realInboundCount` a partir de `sentMessageEvents.direction`;
- os cards principais agora exibem:
  - envios do SDR;
  - respostas do cliente;
  - conversas com avancos;
- a leitura de follow-up pendente passou a considerar threads cuja ultima mensagem foi outbound e ainda nao receberam retorno;
- o feed de atividade recente deixou de duplicar eventos de conversa e passou a usar apenas o historico conversacional;
- o diagnostico executivo agora mostra envios outbound e respostas inbound separados.

Impacto funcional:
- respostas simuladas do cliente nao inflacionam mais os numeros de envio do SDR;
- o dashboard passa a ser coerente com o historico persistido na operacao;
- o card de funil informa volume real de envios e respostas.

Migracoes:
- nenhuma migration foi necessaria neste bloco;
- nenhuma alteracao de schema foi introduzida.

Validacao executada:
- `npm run test`
- `npm run lint`
- `npm run build`
