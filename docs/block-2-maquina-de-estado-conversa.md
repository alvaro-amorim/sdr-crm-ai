# Bloco 2 - Máquina de estado da conversa

## Objetivo
Parar de tratar toda próxima mensagem como um follow-up genérico e passar a registrar o papel real da mensagem no fluxo comercial.

## O que foi implementado
- Helper central para decidir o próximo `prompt_purpose`:
  - `opening`
  - `secondary_follow_up`
  - `qualification_follow_up`
  - `closing_note`
  - `meeting_confirmation`
- A Edge Function `simulate-client-chat` agora calcula o propósito esperado da próxima resposta com base no histórico e no veredito já consolidado.
- A RPC `append_simulation_exchange` passou a persistir `ai_prompt_purpose` no outbound do simulador.
- O primeiro envio confirmado no mock agora cria ou reaproveita `conversation_threads` e registra `conversation_messages`, o que permite distinguir:
  - abordagem inicial
  - abordagem secundária por falta de resposta
  - avanço de qualificação
- A prévia da conversa em `Mensagens IA` mostra o tipo da mensagem outbound diretamente no balão.

## Regras aplicadas
- Sem histórico: `opening`
- Última mensagem outbound sem resposta do cliente: `secondary_follow_up`
- Última mensagem inbound positiva ou neutra: `qualification_follow_up`
- Thread negativa ou fechada: `closing_note`
- Thread com reunião sinalizada: `meeting_confirmation`

## Dependências de runtime
Para ativar completamente este bloco fora do código local ainda é necessário:
1. aplicar a migration `20260422143000_prompt_purpose_state_machine.sql`
2. publicar a Edge Function `simulate-client-chat`

## Validação executada
- `npm run test`
- `npm run lint`
- `npm run build`
