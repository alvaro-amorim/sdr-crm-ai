# Bloco 1 - Veredito da conversa e movimentacao automatica

## Objetivo

Corrigir a origem do status da conversa no simulador autenticavel para que:

- a classificacao use a resposta do cliente e o historico
- recusas claras nao virem "positive"
- a IA encerre a conversa quando houver recusa
- o lead seja movido automaticamente para a etapa correta

## O que mudou

- `src/lib/conversation-verdict.ts`
  - adiciona guardrails deterministicos para recusa clara e aceite de reuniao
  - padroniza `thread_status`, `lead_stage_action` e `should_close`

- `supabase/functions/simulate-client-chat/index.ts`
  - passa a pedir classificacao completa para a IA
  - combina a classificacao da IA com guardrails deterministicos
  - envia para a RPC o status do thread, acao de etapa e fechamento

- `supabase/migrations/20260422133500_fix_simulator_verdict_and_stage_movement.sql`
  - recria `append_simulation_exchange`
  - persiste a classificacao correta
  - move o lead para `Desqualificado`, `Qualificado` ou `Reuniao Agendada` quando aplicavel
  - retorna o thread atualizado para o front

## Validacao esperada

- resposta negativa clara fecha a conversa sem insistencia
- thread negativo fica negativo
- lead recusado vai para `Desqualificado`
- aceite de reuniao move o lead para `Reuniao Agendada`
