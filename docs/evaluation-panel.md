# Painel Auxiliar de Avaliação Técnica

Rota dedicada:

```bash
/__evaluation
```

Essa interface existe apenas para acelerar a validação funcional do sistema por um avaliador técnico. Ela não faz parte do fluxo normal do produto.

## Isolamento

- a rota fica fora da navegação principal;
- em ambiente local ela funciona automaticamente;
- em ambiente remoto ela só deve ser exposta com:

```bash
VITE_ENABLE_EVALUATION_PANEL=true
```

- o painel opera em um workspace dedicado:
  - `Avaliacao Tecnica SDR Expert`
- o reset do painel apaga apenas esse workspace auxiliar.

## O que cada botão faz

### Gerar leads de exemplo

- cria 6 leads determinísticos;
- recria os campos auxiliares usados nessa avaliação;
- recria as regras por etapa ligadas a esses campos;
- não usa IA.

### Criar campanha de exemplo

- cria 1 campanha fixa;
- deixa a área de campanhas navegável sem depender de geração por IA.

### Popular cenário básico de avaliação

- limpa os dados anteriores do workspace auxiliar;
- recria campos, regras, leads e campanha;
- cria 1 thread seeded;
- cria 2 mensagens seeded;
- gera 1 link de simulador pronto para teste;
- não usa IA.

### Resetar dados de avaliação

- limpa apenas os dados do workspace auxiliar;
- não toca em workspaces normais do usuário.

## Atalhos do painel

O painel expõe links diretos para abrir:

- Dashboard
- Leads
- Campanhas
- Mensagens IA
- Simulador seeded

Os links usam `?workspace=` e `?tab=` para forçar a abertura do app principal no workspace técnico correto.

## Quando usar

Use o painel quando o avaliador precisar:

- entrar rapidamente no sistema já com dados navegáveis;
- validar o funil sem cadastro manual;
- abrir mensagens e simulador com um clique;
- resetar o cenário de avaliação com segurança.

## Quando não usar

Não use o painel para:

- fluxo normal de usuários finais;
- seed pesado com alto volume;
- demonstração de geração real por IA.

Para isso, use:

- `npm run test:smoke:crm` para o smoke leve real
- `npm run scenario:evaluation:crm` para o cenário pesado de avaliação
