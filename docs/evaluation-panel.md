# Painel auxiliar de avaliacao tecnica

Rota dedicada:

```bash
/__evaluation
```

Essa interface existe apenas para acelerar a validacao funcional do sistema por um avaliador tecnico. Ela nao faz parte do fluxo normal do produto.

## Isolamento

- a rota fica fora da navegacao principal;
- em ambiente local ela funciona automaticamente;
- em ambiente remoto ela so deve ser exposta com:

```bash
VITE_ENABLE_EVALUATION_PANEL=true
```

- o painel opera no workspace atual da sessao do avaliador;
- quando aberto pelo guia operacional, a URL recebe `?workspace=` com o workspace que o avaliador acabou de criar ou selecionou;
- o reset do painel apaga apenas os dados seeded de avaliacao desse workspace, nao workspaces normais inteiros.

## O que cada botao faz

### Gerar leads de exemplo

- cria 6 leads deterministicos;
- recria os campos auxiliares usados nessa avaliacao;
- recria as regras por etapa ligadas a esses campos;
- nao usa IA.

### Criar campanha de exemplo

- cria 1 campanha fixa;
- deixa a area de campanhas navegavel sem depender de geracao por IA.

### Popular cenario basico de avaliacao

- limpa os dados seeded anteriores no workspace atual;
- recria campos, regras, leads e campanha;
- cria 1 thread seeded;
- cria 2 mensagens seeded;
- gera 1 link de chat como cliente pronto para teste;
- nao usa IA.

### Resetar dados de avaliacao

- limpa apenas os dados seeded de avaliacao do workspace atual;
- nao toca em dados normais que nao usam o marcador interno de avaliacao.

## Atalhos do painel

O painel expoe links diretos para abrir:

- Dashboard
- Leads
- Campanhas
- Mensagens IA
- Chat como cliente, quando a conversa seeded existir

Os links usam `?workspace=` e `?tab=` para abrir o app principal no workspace da sessao do avaliador.

## Fluxo recomendado para o avaliador

1. Criar conta ou entrar no app.
2. Criar o workspace inicial quando o app solicitar.
3. Abrir o guia operacional do dashboard.
4. Clicar em `Abrir painel do avaliador`.
5. No painel, clicar em `Popular cenario basico de avaliacao`.
6. Usar os atalhos para validar Dashboard, Leads, Campanhas, Mensagens IA e chat como cliente.

## Quando usar

Use o painel quando o avaliador precisar:

- entrar rapidamente no sistema ja com dados navegaveis;
- validar o funil sem cadastro manual;
- abrir mensagens e chat como cliente com um clique;
- resetar os dados seeded de avaliacao com seguranca.

## Quando nao usar

Nao use o painel para:

- fluxo normal de usuarios finais;
- seed pesado com alto volume;
- demonstracao de geracao real por IA.

Para isso, use:

- `npm run test:smoke:crm` para o smoke leve real;
- `npm run scenario:evaluation:crm` para o cenario pesado de avaliacao.
