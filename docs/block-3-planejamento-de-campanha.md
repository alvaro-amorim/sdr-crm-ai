# Bloco 3 - Planejamento de campanha em duas etapas

## Objetivo

Remover a dependência de prompt manual bruto na criação de campanhas e introduzir um fluxo em duas etapas:

1. o usuário informa o briefing comercial;
2. a IA devolve um plano de campanha revisável antes do salvamento.

## O que mudou

- o formulário de campanhas agora pede apenas o briefing operacional;
- foi criada a Edge Function `plan-campaign-strategy`;
- a IA retorna:
  - objetivo
  - ICP
  - dor principal
  - tom recomendado
  - CTA sugerido
  - tratamento de objeções
  - sequência sugerida
  - prompt final aprovado
- o usuário pode:
  - gerar o plano
  - gerar novamente
  - editar manualmente os campos
  - salvar a campanha só depois da revisão

## Compatibilidade

O banco não mudou de estrutura neste bloco. A tabela `campaigns` continua salvando `context_text` e `generation_prompt`. A diferença é que o `generation_prompt` agora nasce do plano aprovado em tela.

## Proteções

- o formulário bloqueia salvamento sem nome e contexto;
- o formulário bloqueia salvamento sem `final_prompt`;
- a Edge Function exige autenticação válida e participação no workspace;
- a chamada de IA usa fallback entre modelos para reduzir falhas de planejamento.
