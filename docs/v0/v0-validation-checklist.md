# v0 Validation Checklist

Use esta checklist após qualquer mudança trazida do v0.

## Validação técnica obrigatória

- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] nenhum import quebrado
- [ ] nenhuma referência nova a env sensível no frontend

## Rotas e entrada

- [ ] `/` continua abrindo corretamente
- [ ] `/client-simulator?token=...` continua abrindo
- [ ] login funciona
- [ ] logout funciona
- [ ] criação de conta continua íntegra

## Dashboard

- [ ] métricas continuam renderizando
- [ ] atalhos operacionais continuam abrindo o estado correto
- [ ] modal de diagnóstico continua acessível

## Leads

- [ ] formulário continua salvando
- [ ] lead em foco continua atualizando
- [ ] board continua visível
- [ ] mudança de etapa continua respeitando bloqueios

## Campanhas

- [ ] briefing continua editável
- [ ] plano da IA continua gerando
- [ ] prompt final continua revisável
- [ ] campanha continua salvando

## Mensagens IA

- [ ] geração continua funcionando
- [ ] variações continuam aparecendo
- [ ] conversa operacional continua visível
- [ ] abertura do simulador continua disponível

## Envio simulado e simulador

- [ ] envio simulado continua registrando evento
- [ ] lead continua movendo para a etapa esperada
- [ ] simulador público continua aceitando resposta
- [ ] erro com token inválido continua tratado

## Responsividade básica

- [ ] sem rolagem horizontal no mobile
- [ ] menu mobile continua utilizável
- [ ] formulários continuam legíveis
- [ ] modais e painéis não estouram
