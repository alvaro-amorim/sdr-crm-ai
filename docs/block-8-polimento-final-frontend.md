# Bloco 8 — Polimento final antes do refinamento do frontend

## Objetivo

Fechar a base atual do CRM antes da etapa de refinamento visual com microcopy consistente, acentuação correta e um roteiro claro para validação final em um usuário limpo.

## Alterações

- Corrigida a acentuação de textos do fluxo de campanha em duas etapas.
- Padronizadas mensagens de erro e dicas do formulário de campanha.
- Revisados os textos que aparecem no plano de ação gerado por IA para evitar ruído visual durante a avaliação.
- Mantida a regra operacional: a OpenAI continua restrita às Edge Functions e ao smoke local opcional, sem expor chave no frontend.

## Validação antes do smoke final

Antes de pedir a execução do teste final em um perfil zerado, atualize o `.env.local` com o usuário reservado para avaliação:

```bash
TEST_USER_EMAIL=email-limpo-de-avaliacao@example.com
TEST_USER_PASSWORD=senha-do-usuario-limpo
SMOKE_WORKSPACE_NAME=Operação SDR Demo
SMOKE_PUBLIC_BASE_URL=https://sdr-crm-ai-wine.vercel.app
SMOKE_WAVE=all
SMOKE_THREAD_LIMIT=75
SMOKE_AI_DELAY_MS=500
```

Regras importantes:

- Não use aspas nos valores do `.env.local`.
- Use um usuário já confirmado no Supabase Auth.
- Mantenha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` apontando para o mesmo projeto Supabase usado pela Vercel.
- Não coloque `OPENAI_API_KEY` na Vercel do frontend. A chave deve ficar em secrets das Edge Functions. Localmente, ela é opcional.

## Próximo passo

Após trocar o usuário no `.env.local`, execute ou peça ao Codex para executar:

```bash
npm run test:smoke:crm
```

O resultado esperado é um workspace novo com 100 leads, 4 campanhas, conversas em múltiplos estados, mensagens de abordagem, follow-ups secundários, respostas do cliente e tokens do simulador público.
