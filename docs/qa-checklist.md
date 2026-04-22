# QA Checklist

## Fase atual

Base funcional do MVP criada com frontend React, schema Supabase, RLS, Edge Functions de IA, simulador público por token e testes de regras puras.

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
  - cria 100 leads com nomes, empresas, cargos, canais e estágios variados
  - cria 4 campanhas oficiais da demonstração
  - executa Onda 1 e Onda 2 com conversas geradas por OpenAI real
  - semeia `conversation_threads`, `conversation_messages`, `generated_messages`, `sent_message_events` e tokens do simulador
  - valida volume mínimo de 75 conversas e pelo menos 220 mensagens quando `SMOKE_WAVE=all`
  - deixa a interface pronta para avaliação com múltiplos estados operacionais

## Testes manuais previstos

1. Auth
   - Criar conta com e-mail fictício.
   - Confirmar que o cadastro exige senha e confirmação de senha iguais.
   - Confirmar que os campos de senha permitem revelar/ocultar o valor digitado.
   - Confirmar que o app exibe orientação de verificação de e-mail após cadastro.
   - Usar `Esqueci a senha` e confirmar envio de link seguro.
   - Abrir link de recuperação e definir nova senha.
   - Entrar com Google OAuth após configurar provider no Supabase.
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

7. Navegação mobile
   - Confirmar que o menu lateral abre via botão `Menu`.
   - Confirmar que o menu fecha ao tocar fora, ao fechar manualmente e ao trocar de aba.
   - Confirmar que campos de senha mantêm reveal sem quebrar a largura do input.

8. Simulador do cliente
   - Entrar em `Mensagens IA`.
   - Abrir o atalho `Abrir janela do cliente`.
   - Responder como cliente na nova janela.
   - Confirmar que a próxima resposta da IA aparece no chat.
   - Voltar ao CRM, atualizar e confirmar que a conversa foi persistida.

## Convenção do smoke realista

- O smoke usa um workspace dedicado para demonstração.
- O nome padrão é `Operação SDR Demo`, mas pode ser sobrescrito por `SMOKE_WORKSPACE_NAME`.
- O script foi desenhado para ser reexecutável no mesmo perfil de teste sem contaminar outros workspaces.
- As credenciais do usuário de teste e a chave OpenAI local devem ficar apenas no `.env.local`:
  - `TEST_USER_EMAIL`
  - `TEST_USER_PASSWORD`
  - `OPENAI_API_KEY` local opcional; se ausente, o smoke usa a Edge Function autenticada `generate-smoke-conversation`.

## Revisão de segurança

- `.env*` ignorados no Git.
- `.env.example` não contém segredos reais.
- Service role restrita a Edge Functions.
- RLS adicionada nas tabelas funcionais.
- Edge Functions autenticadas validam usuário e membership antes de acessar dados internos.
- O simulador público acessa apenas uma conversa específica via token temporário, sem expor o workspace inteiro.
- O simulador público resolve e grava mensagens por RPC `security definer` usando o hash do token como autorização, sem depender de service role no cliente público.
