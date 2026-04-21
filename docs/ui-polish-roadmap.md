# UI Polish Roadmap

## Objetivo

Elevar a percepção do produto antes da migração visual para o Lovable, preservando a base funcional já validada:

- autenticação
- workspace
- leads
- campanhas
- geração de mensagens por IA
- envio simulado com movimentação do lead no funil

## Regras de execução

1. Não avançar de etapa com `lint`, `test` ou `build` quebrados.
2. Toda etapa precisa de validação manual em desktop e mobile.
3. Mudanças devem ser pequenas, rastreáveis e acompanhadas de commit claro.
4. O fluxo principal precisa continuar íntegro:
   - login
   - criação/entrada no workspace
   - criação de lead
   - criação de campanha
   - geração de mensagens
   - envio simulado
   - lead movido para `Tentando Contato`
5. O smoke test continua obrigatório quando a etapa afetar o fluxo principal.

## Etapas

### Etapa 0 — Baseline visual

- mapear os padrões já existentes
- definir critérios de hierarquia, densidade, feedback e responsividade
- documentar o plano

### Etapa 1 — Layout-base

- melhorar shell do app
- reforçar hierarquia da sidebar
- destacar workspace ativo
- padronizar cabeçalhos, blocos e feedbacks

### Etapa 2 — Dashboard

- transformar em cockpit comercial
- reforçar leitura executiva
- incluir atividade recente real
- dar mais clareza ao funil

### Etapa 3 — Leads

- melhorar leitura operacional
- aproximar a tela de um fluxo real de SDR
- reforçar funil, detalhe do lead e ações rápidas

### Etapa 4 — Campanhas

- apresentar campanha como playbook de abordagem
- separar melhor configuração e histórico/listagem
- melhorar leitura de contexto, prompt e gatilho

### Etapa 5 — Mensagens IA

- transformar na principal tela de demonstração
- mostrar contexto do lead, campanha usada e resultado da IA
- melhorar legibilidade das variações geradas

### Etapa 6 — Mock de chat para envio simulado

- abrir um mock de conversa realista
- registrar evento real no banco
- refletir visualmente o envio
- mover o lead para `Tentando Contato`

### Etapa 7 — Responsividade

- revisar telas internas em mobile
- garantir que modais, cards, selects e barras não quebrem

### Etapa 8 — Polimento final antes do Lovable

- revisar microcopy
- revisar estados vazios
- revisar feedbacks
- revisar consistência visual

## Critério para considerar esta fase pronta

- fluxo principal validado localmente e na Vercel
- telas principais com leitura clara para avaliação
- mock de chat funcionando como demonstração realista
- documentação atualizada
- commits claros por bloco funcional
