# QA Checklist

## Fase atual

Base funcional do MVP criada com frontend React, schema Supabase, RLS, Edge Function de IA e testes de regras puras.

## Testes automatizados

- `npm run test`
  - valida erro seguro quando env pública está ausente
  - valida env pública correta
  - valida `field_key` seguro
  - valida bloqueio por campo padrão obrigatório ausente
  - valida bloqueio por campo personalizado obrigatório ausente
  - valida transição quando obrigatórios estão preenchidos
- `npm run test:smoke:crm`
  - autentica com um usuário real de teste
  - cria ou reutiliza o workspace dedicado `Operação SDR Demo`
  - limpa o workspace demo antes de reseedar
  - cria campos personalizados e regras por etapa
  - cria leads com nomes e empresas realistas em vários estágios do funil
  - cria campanhas/playbooks com contextos e gatilhos plausíveis
  - valida a Edge Function de IA gerando mensagens reais para o lead principal
  - semeia histórico de mensagens com envios simulados e respostas do cliente
  - deixa a interface pronta para avaliação com múltiplos estados operacionais

## Testes manuais previstos

1. Auth
   - Criar conta com e-mail fictício.
   - Confirmar que o cadastro exige senha e confirmação de senha iguais.
   - Confirmar que os campos de senha permitem revelar/ocultar o valor digitado.
   - Confirmar que o app exibe orientacao de verificacao de e-mail apos cadastro.
   - Usar `Esqueci a senha` e confirmar envio de link seguro.
   - Abrir link de recuperacao e definir nova senha.
   - Entrar com Google OAuth apos configurar provider no Supabase.
   - Entrar e sair.
   - Confirmar que rota interna não aparece sem sessão.

2. Workspace
   - Criar workspace.
   - Confirmar criação das etapas padrão.
   - Confirmar que a RPC `create_workspace_with_defaults` foi aplicada.
   - Confirmar que dados carregados pertencem ao workspace atual.

3. Leads
   - Criar lead com nome mínimo.
   - Editar lead sem perder dados.
   - Criar campo personalizado e salvar valor no lead.

4. Pipeline
   - Marcar e-mail como obrigatório para `Qualificado`.
   - Tentar mover lead sem e-mail e confirmar bloqueio.
   - Preencher e-mail e confirmar movimentação.

5. Campanhas e IA
   - Criar campanha ativa.
   - Selecionar lead e campanha.
   - Gerar mensagens com Edge Function configurada.
   - Simular envio e confirmar mudança para `Tentando Contato`.

6. Dashboard
   - Confirmar contagens reais de leads por etapa.
   - Confirmar estado vazio sem erro.

## Convenção do smoke realista

- O smoke usa um workspace dedicado para demonstração.
- O nome padrão é `Operação SDR Demo`, mas pode ser sobrescrito por `SMOKE_WORKSPACE_NAME`.
- O script foi desenhado para ser reexecutável no mesmo perfil de teste sem contaminar outros workspaces.
- As credenciais do usuário de teste devem ficar apenas no `.env.local`:
  - `TEST_USER_EMAIL`
  - `TEST_USER_PASSWORD`

## Revisão de segurança

- `.env*` ignorados no Git.
- `.env.example` não contém segredos reais.
- Service role restrita a Edge Function.
- RLS adicionada nas tabelas funcionais.
- Edge Function valida usuário e membership antes de acessar lead/campanha.
