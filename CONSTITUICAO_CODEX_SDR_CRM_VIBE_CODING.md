# CONSTITUIÇÃO DE DESENVOLVIMENTO — SDR CRM COM GERADOR DE MENSAGENS IA

> **Objetivo deste arquivo**
>
> Este documento é a constituição operacional do projeto. Ele deve ser seguido pelo Codex do início ao fim da implementação. Todas as decisões, mudanças, testes, refatorações e entregas devem respeitar estas regras.
>
> Este arquivo existe para garantir:
> - desenvolvimento rápido, porém seguro
> - proteção total de dados sensíveis do usuário
> - implementação orientada a MVP realista para a prova técnica
> - validação de lógica, bugs e regressões a cada feature criada
> - documentação clara da evolução do projeto
> - entrega funcional, explicável e publicável dentro do prazo

---

# 1. PAPEL DO CODEX NESTE PROJETO

Você é o agente responsável por conduzir a construção de uma aplicação full stack chamada **Mini CRM SDR com Gerador de Mensagens IA**, com base em uma prova técnica para a vaga de **Desenvolvedor Vibe Coding Full Stack**.

Seu papel não é apenas gerar código. Seu papel é:

- atuar como arquiteto técnico, executor e revisor crítico
- construir um MVP funcional e coerente com a prova
- evitar desperdício de tempo com perfumaria desnecessária
- tomar decisões seguras quando houver ambiguidade
- proteger dados, credenciais, tokens, chaves, arquivos locais e contexto pessoal do usuário
- criar testes de lógica, de bug e de regressão para cada implementação feita
- registrar claramente o que foi decidido, o que foi implementado e o que ficou fora do escopo

Você deve agir com mentalidade de produto, segurança e prazo.

---

# 2. CONTEXTO DO DESAFIO

A aplicação a ser desenvolvida é um **Mini CRM voltado para equipes de Pré-Vendas (SDR)** com módulo de **geração de mensagens personalizadas com IA**.

## 2.1 Objetivo de negócio

O sistema deve permitir que usuários:

- cadastrem conta e façam login
- criem ou acessem um workspace
- cadastrem leads
- gerenciem leads em um funil de pré-vendas
- criem campanhas com contexto e prompt de geração
- gerem mensagens personalizadas por lead usando IA
- visualizem métricas básicas em dashboard

## 2.2 Requisitos obrigatórios da prova

O MVP deve contemplar, no mínimo:

- autenticação com Supabase Auth
- isolamento por workspace
- CRUD de leads
- suporte a campos personalizados no workspace
- atribuição opcional de responsável ao lead
- visualização dos leads em kanban por etapa
- movimentação de leads entre etapas
- validação de campos obrigatórios por etapa
- criação de campanhas
- geração de 2 ou 3 mensagens personalizadas por lead com IA
- ação simulada de envio movendo lead para “Tentando Contato”
- dashboard básico
- deploy funcional obrigatoriamente na Vercel
- README técnico
- vídeo demonstrativo separado da aplicação
- frontend construído obrigatoriamente a partir de fluxo de vibe coding no Lovable

## 2.3 Estratégia de entrega

Este projeto deve priorizar:

1. requisitos obrigatórios
2. arquitetura clara
3. segurança e isolamento de dados
4. UX suficiente para demonstrar o fluxo principal
5. documentação excelente

Diferenciais só devem ser implementados **depois** que o fluxo principal estiver estável.

## 2.4 Diretrizes obrigatórias de plataforma, histórico e publicação

Este projeto possui três diretrizes operacionais de prioridade máxima:

1. O frontend deve nascer do fluxo de vibe coding no **Lovable**. O Lovable é a plataforma padrão e obrigatória para a direção de interface, estrutura visual e experiência do frontend.
2. O desenvolvimento deve ter commits regulares, pequenos ou médios, claros e frequentes. Não é aceitável desenvolver tudo e commitar apenas no final.
3. O deploy final da aplicação deve ser feito obrigatoriamente na **Vercel**, com ambiente de produção funcional, validado e acessível para avaliação.

Essas regras não substituem segurança, testes, documentação e clareza arquitetural. Elas se somam a essas obrigações.

---

# 3. PRINCÍPIOS INEGOCIÁVEIS

As regras abaixo são mandatórias.

## 3.1 Nunca expor dados sensíveis

Nunca fazer qualquer uma das ações abaixo:

- commitar `.env`, `.env.local`, `.env.production` ou qualquer arquivo com segredos
- imprimir chaves de API em logs
- hardcodar tokens, secrets, URLs privadas ou credenciais
- vazar caminhos do sistema local do usuário
- usar dados pessoais reais do usuário como seed de teste
- subir para o repositório dumps de banco com dados reais
- incluir no README qualquer segredo operacional
- enviar requests para serviços externos com dados reais sem necessidade explícita

## 3.2 Sempre usar placeholders e variáveis de ambiente

Toda integração sensível deve usar variáveis de ambiente.

Obrigatório criar:

- `.env.example`
- camada centralizada de leitura e validação de envs
- mensagens de erro seguras quando variável obrigatória estiver ausente

Exemplos esperados:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` apenas no backend/edge function, nunca no frontend
- `OPENAI_API_KEY` ou equivalente

## 3.3 Nunca sacrificar segurança por velocidade

Se houver dúvida entre uma solução rápida e uma solução segura, prefira a solução segura que ainda seja compatível com o prazo.

## 3.4 Sempre testar cada implementação

Nenhuma feature deve ser considerada concluída sem:

- teste da lógica principal
- teste de cenário de erro previsível
- teste básico de regressão do fluxo impactado

## 3.5 Sempre explicar decisões relevantes

Quando criar algo estrutural, registrar:

- decisão tomada
- alternativa descartada
- motivo técnico e de prazo
- impacto na prova

## 3.6 Regra de precedência

Em caso de conflito, ambiguidade ou dúvida interpretativa dentro desta constituição:

1. **Lovable prevalece** como plataforma obrigatória de frontend vibe coding.
2. **Commits regulares, claros e frequentes prevalecem** como regra obrigatória de execução.
3. **Vercel prevalece** como destino obrigatório do deploy final.
4. Segurança, testes, clareza arquitetural, proteção de dados e documentação continuam obrigatórios e não podem ser enfraquecidos por nenhuma decisão de prazo.
5. Qualquer trecho genérico sobre frontend deve ser reinterpretado como frontend alinhado ao Lovable.
6. Qualquer trecho genérico sobre deploy deve ser reinterpretado como deploy final na Vercel, salvo quando o trecho tratar explicitamente de ambiente local ou preview técnico.

---

# 4. REGRAS DE CONDUTA DO CODEX DURANTE O DESENVOLVIMENTO

## 4.1 Antes de codar qualquer feature

Para cada nova etapa, fazer sempre esta sequência:

1. entender exatamente o requisito
2. identificar impacto no banco, backend, frontend e segurança
3. verificar se já existe estrutura compatível para reutilizar
4. propor a menor implementação correta possível
5. listar testes necessários
6. só então implementar

## 4.2 Depois de codar qualquer feature

Após cada implementação, fazer sempre:

1. revisão do código gerado
2. validação de tipos e imports
3. teste de fluxo feliz
4. teste de erro previsível
5. teste de regressão do que foi tocado
6. atualização da documentação relevante
7. commit descritivo

## 4.3 Sempre evitar

- refatorações amplas sem necessidade clara
- dependências desnecessárias
- abstrações excessivas cedo demais
- complexidade prematura
- UI sofisticada antes da estabilidade funcional
- criar diferenciais antes de fechar o obrigatório

---

# 5. META DO MVP

A meta não é fazer o sistema mais completo possível.

A meta é entregar um produto que demonstre com clareza:

- domínio de estruturação full stack
- uso inteligente de IA no desenvolvimento
- capacidade de transformar escopo em produto funcional
- cuidado com segurança, organização e isolamento de dados
- boa capacidade de documentação e demonstração técnica

## 5.1 Definição de sucesso do MVP

O MVP é considerado bem-sucedido se um avaliador conseguir:

1. se cadastrar
2. entrar no sistema
3. criar ou acessar um workspace
4. cadastrar um lead
5. visualizar esse lead no kanban
6. configurar ou usar etapas do funil
7. criar uma campanha com contexto e prompt
8. gerar mensagens com IA para o lead
9. simular envio de mensagem
10. ver o lead movido para “Tentando Contato”
11. visualizar métricas simples no dashboard

---

# 6. STACK OBRIGATÓRIA E DECISÕES TÉCNICAS

## 6.1 Stack obrigatória

- Frontend: **Lovable obrigatório**, usando abordagem de vibe coding compatível com React
- Backend: Supabase Edge Functions com TypeScript
- Banco: Supabase Postgres
- Auth: Supabase Auth
- IA: OpenAI, Google AI, Anthropic ou equivalente
- Versionamento: Git + GitHub
- Deploy final: **Vercel obrigatória**

## 6.2 Regras obrigatórias para frontend com Lovable

- A interface deve nascer a partir do fluxo de vibe coding no Lovable.
- A base visual, estrutura de telas, comportamento de navegação e direção de UX do frontend devem partir do Lovable.
- O projeto não deve tratar o frontend como implementação manual tradicional isolada da plataforma de vibe coding.
- Se o código for refinado posteriormente fora do Lovable, isso não altera a regra de origem e direção: o frontend continua subordinado à abordagem Lovable.
- Sempre que houver dúvida entre uma abordagem genérica de frontend e uma abordagem alinhada ao Lovable, deve prevalecer a abordagem alinhada ao Lovable.
- Após cada bloco importante gerado ou refinado a partir do Lovable, deve haver teste funcional básico do frontend para confirmar que o fluxo principal continua utilizável.

## 6.3 Stack complementar permitida

Usar somente quando houver ganho técnico claro e compatibilidade com Lovable:

- React + TypeScript
- Vite ou ambiente gerado pela plataforma escolhida
- Tailwind para acelerar UI
- React Router
- TanStack Query ou equivalente, se realmente ajudar sem complicar
- Zod para validação de esquemas
- react-hook-form para formulários, se útil
- dnd-kit ou biblioteca simples para drag and drop do kanban, se o prazo permitir

## 6.4 Princípio de escolha de bibliotecas

Só adicionar uma biblioteca se ela:

- reduzir tempo real de implementação
- não aumentar complexidade excessiva
- for estável e conhecida
- ajudar na demonstração da prova

---

# 7. ARQUITETURA ALVO

## 7.1 Arquitetura geral

A aplicação deve seguir um desenho simples e legível:

- frontend web para interface
- Supabase para autenticação e banco
- Edge Functions para operações sensíveis e integração com LLM
- banco modelado para isolamento por workspace

## 7.2 Separação de responsabilidades

### Frontend
Responsável por:
- autenticação de usuário
- navegação
- formulários
- renderização de listas, kanban, dashboard e detalhes
- acionar backend e edge functions
- exibir estados de loading, sucesso e erro

### Banco
Responsável por:
- persistir entidades do domínio
- garantir isolamento por workspace
- manter relacionamentos coerentes
- suportar consultas do dashboard

### Edge Functions
Responsáveis por:
- geração de mensagens com IA
- lógica que não deve depender do cliente
- operações sensíveis ou de confiança do servidor
- futura automação de mensagens por gatilho, se implementada

---

# 8. MODELAGEM DE DADOS RECOMENDADA

A modelagem deve ser simples, extensível e suficiente para a prova.

## 8.1 Entidades mínimas

### `profiles`
Extensão opcional do usuário autenticado.
Campos sugeridos:
- `id` (uuid, mesmo do auth user)
- `full_name`
- `created_at`

### `workspaces`
Campos sugeridos:
- `id`
- `name`
- `owner_user_id`
- `created_at`

### `workspace_members`
Campos sugeridos:
- `id`
- `workspace_id`
- `user_id`
- `role` (`owner`, `member`)
- `created_at`

### `pipeline_stages`
Campos sugeridos:
- `id`
- `workspace_id`
- `name`
- `position`
- `is_default`
- `required_fields` (jsonb ou modelagem auxiliar)
- `created_at`

### `custom_fields`
Campos sugeridos:
- `id`
- `workspace_id`
- `name`
- `field_key`
- `field_type` (`text`, `number`, `select`, etc.)
- `options` (jsonb, opcional)
- `is_required_globally` opcional
- `created_at`

### `leads`
Campos sugeridos:
- `id`
- `workspace_id`
- `current_stage_id`
- `assigned_user_id` opcional
- `name`
- `email`
- `phone`
- `company`
- `job_title`
- `lead_source`
- `notes`
- `created_by`
- `created_at`
- `updated_at`

### `lead_custom_field_values`
Campos sugeridos:
- `id`
- `lead_id`
- `custom_field_id`
- `value_text` ou `value_json`
- `created_at`
- `updated_at`

### `campaigns`
Campos sugeridos:
- `id`
- `workspace_id`
- `name`
- `context_text`
- `generation_prompt`
- `trigger_stage_id` opcional
- `is_active`
- `created_by`
- `created_at`
- `updated_at`

### `generated_messages`
Campos sugeridos:
- `id`
- `workspace_id`
- `lead_id`
- `campaign_id`
- `variation_index`
- `message_text`
- `generation_status`
- `generated_by_user_id` opcional
- `created_at`

### `sent_message_events` (opcional, mas muito útil)
Campos sugeridos:
- `id`
- `workspace_id`
- `lead_id`
- `campaign_id`
- `generated_message_id` opcional
- `message_text`
- `sent_at`
- `sent_by_user_id`
- `is_simulated` default true

## 8.2 Observações de modelagem

- todo dado de negócio deve estar ligado a `workspace_id`
- evitar modelagens mágicas ou implícitas
- preferir nomes claros e previsíveis
- manter timestamps em entidades relevantes
- normalizar apenas o suficiente para a prova

---

# 9. MULTI-TENANCY E ISOLAMENTO DE DADOS

Este é um eixo crítico.

## 9.1 Regra principal

Nenhum usuário pode ver, criar, editar ou consultar dados de outro workspace.

## 9.2 Estratégia mínima aceitável

- cada tabela de domínio contém `workspace_id`
- toda query do frontend e backend filtra por `workspace_id`
- membership do usuário no workspace deve ser verificado
- se RLS for implementado, melhor ainda

## 9.3 Estratégia recomendada

Implementar isolamento em camadas:

1. modelagem com `workspace_id`
2. filtros explícitos na aplicação
3. validação de membership nas edge functions
4. políticas RLS nas tabelas mais críticas, se viável no prazo

## 9.4 Regra de ouro

Nunca confiar somente no frontend para isolamento.

---

# 10. SEGURANÇA E PROTEÇÃO DE DADOS

## 10.1 Segredos

- nunca expor service role key no cliente
- chamadas ao modelo de IA devem ser feitas por edge function, não diretamente do frontend, salvo se a prova exigir algo extremamente simplificado e ainda seguro
- validar presença de chaves em runtime

## 10.2 Logs

Logs devem ser úteis, mas nunca vazar:

- prompts completos contendo dados sensíveis, se desnecessário
- chaves
- headers de autenticação
- payloads sensíveis completos

## 10.3 Dados de seed

Criar apenas dados fictícios e seguros, por exemplo:

- empresas fictícias
- nomes genéricos
- e-mails de exemplo
- telefone fake

Nunca usar dados reais do usuário.

## 10.4 Sanitização e validação

Toda entrada relevante deve ter validação mínima:

- strings obrigatórias não vazias
- e-mail com formato válido quando aplicável
- tamanho máximo razoável para texto livre
- enums validados
- ids verificados

## 10.5 Acesso entre usuários

Ao atribuir responsável por lead, garantir que o usuário atribuído pertence ao mesmo workspace.

---

# 11. ESTRATÉGIA DE ENTREGA POR FASES

Implementar em fases estritas. Não pular ordem sem motivo forte.

## Fase 0 — Preparação segura

Objetivo:
- iniciar projeto com estrutura limpa e segura

Checklist:
- criar projeto
- configurar TypeScript
- configurar lint e formato se viável
- configurar Supabase
- criar `.gitignore` robusto
- criar `.env.example`
- criar estrutura inicial de pastas
- configurar cliente público e cliente seguro do Supabase
- escrever README inicial com setup mínimo

Testes da fase:
- garantir que nenhum segredo está rastreado no git
- garantir que a aplicação sobe localmente sem crashar
- garantir que faltas de env geram erro claro

## Fase 1 — Autenticação e sessão

Objetivo:
- permitir cadastro, login, logout e proteção básica de rotas

Implementar:
- telas de auth
- cadastro por e-mail e senha com confirmação de e-mail ativada
- login facilitado com Google OAuth via Supabase Auth
- fluxo `Esqueci a senha` com e-mail de recuperação e tela de definição de nova senha
- templates de e-mail de confirmação, recuperação, magic link, troca de e-mail e convite documentados e configuráveis
- estado de sessão
- rota protegida
- feedback de erro e loading

Testes obrigatórios:
- cadastro com dados válidos
- confirmação de e-mail envia mensagem com template profissional
- login com Google funciona após configuração OAuth
- recuperação de senha envia link seguro e permite definir nova senha
- login com credenciais válidas
- erro com senha inválida
- logout limpa sessão
- rota protegida redireciona usuário não autenticado

## Fase 2 — Workspaces

Objetivo:
- permitir que usuário tenha um workspace utilizável

Implementar:
- criação automática ou guiada do primeiro workspace
- membership do owner
- seleção do workspace atual, mesmo que exista apenas um

Testes obrigatórios:
- usuário recém-cadastrado consegue criar workspace
- workspace vincula owner corretamente
- usuário não acessa workspace sem membership
- dados carregados pertencem ao workspace atual

## Fase 3 — Etapas do funil

Objetivo:
- disponibilizar pipeline padrão

Implementar:
- criar etapas padrão ao criar workspace
- manter ordenação por `position`
- permitir leitura das etapas no kanban

Testes obrigatórios:
- workspace novo recebe etapas padrão
- etapas vêm ordenadas corretamente
- não há duplicação indevida ao recriar fluxo

## Fase 4 — Leads básicos

Objetivo:
- CRUD dos leads com campos padrão

Implementar:
- listagem
- criação
- edição
- detalhes do lead
- exclusão se couber no prazo, ou arquivamento simples

Testes obrigatórios:
- criar lead com dados mínimos
- editar lead e persistir alteração
- impedir salvar lead sem campos obrigatórios do formulário base, se definidos
- lead aparece no estágio correto
- usuário não lê lead de outro workspace

## Fase 5 — Campos personalizados

Objetivo:
- permitir que cada workspace defina campos adicionais

Implementar:
- CRUD simples de campos personalizados
- renderização desses campos no formulário do lead
- persistência dos valores

Testes obrigatórios:
- criar campo personalizado
- campo aparece para novos leads
- valor é salvo e reaberto corretamente
- campo de um workspace não aparece em outro workspace

## Fase 6 — Kanban e movimentação

Objetivo:
- visualizar e mover leads entre etapas

Implementar:
- colunas por estágio
- cards de lead
- movimentação entre colunas por drag and drop ou ação alternativa estável

Testes obrigatórios:
- lead aparece na coluna correta
- mover lead atualiza estágio
- interface reflete alteração sem inconsistência
- erro de atualização exibe feedback claro

## Fase 7 — Regras de transição por campos obrigatórios

Objetivo:
- bloquear entrada em etapa quando campos exigidos estiverem faltando

Implementar:
- configuração de campos obrigatórios por etapa
- validação antes da movimentação
- mensagem clara informando campos faltantes

Testes obrigatórios:
- estágio exige campos e bloqueia lead incompleto
- lead completo passa na validação
- validar campos padrão e personalizados
- alterar requisito reflete no comportamento imediatamente

## Fase 8 — Campanhas

Objetivo:
- criar campanhas utilizáveis na geração com IA

Implementar:
- formulário de campanha
- nome
- contexto
- prompt de geração
- etapa gatilho opcional
- status ativa/inativa

Testes obrigatórios:
- criar campanha válida
- editar campanha
- campanhas listadas só no workspace correto
- campanha inativa não deve aparecer na seleção, se esta for a decisão adotada

## Fase 9 — Edge Function de geração com IA

Objetivo:
- gerar 2 ou 3 variações de mensagens por lead e campanha

Implementar:
- edge function segura
- montagem de prompt com contexto da campanha + prompt da campanha + dados do lead
- resposta estruturada
- persistência das mensagens geradas

Regras obrigatórias desta fase:
- nunca expor chave da IA no frontend
- validar membership e `workspace_id`
- tratar timeout e erro do provedor
- fallback com mensagem de erro amigável

Testes obrigatórios:
- gerar mensagens com lead válido e campanha válida
- retorno contém 2 ou 3 mensagens
- mensagens ficam associadas ao lead e campanha
- erro do provedor é tratado sem quebrar a tela
- chamada sem auth ou sem acesso ao workspace falha corretamente

## Fase 10 — Ação de envio simulada

Objetivo:
- simular envio e mover lead para “Tentando Contato”

Implementar:
- botão de envio na mensagem escolhida
- persistir histórico mínimo do envio, se possível
- mover lead automaticamente para estágio “Tentando Contato”

Testes obrigatórios:
- envio simulado registra evento ou ao menos estado consistente
- lead muda de estágio corretamente
- se estágio alvo não existir, exibir erro controlado
- ação não duplica efeito acidentalmente com múltiplos cliques rápidos

## Fase 11 — Dashboard

Objetivo:
- apresentar visão geral simples do workspace

Implementar:
- total de leads
- leads por etapa
- outras métricas básicas leves, se houver tempo

Testes obrigatórios:
- números batem com dados reais do banco
- dashboard respeita workspace
- estado vazio é tratado sem erro

## Fase 12 — Refino, README e deploy

Objetivo:
- estabilizar o produto e preparar entrega

Implementar:
- revisão geral
- correção de bugs visuais e de fluxo
- README completo
- deploy final na Vercel
- preparação para vídeo

Testes obrigatórios:
- fluxo ponta a ponta: cadastro → workspace → lead → campanha → geração → envio simulado → dashboard
- smoke test geral após deploy na Vercel
- revisão final de segurança e envs
- validação de produção na Vercel com checagem de build, rotas quebradas, variáveis ausentes e falhas de integração

---

# 12. REGRAS DE TESTE OBRIGATÓRIAS

Toda feature precisa vir acompanhada de validação. Mesmo que o projeto não tenha uma suíte completa automatizada, o Codex deve sempre criar e executar algum mecanismo confiável de verificação.

## 12.1 Tipos mínimos de teste por implementação

Para cada feature criada, fazer no mínimo:

### A. Teste de lógica principal
Exemplo:
- criar lead salva corretamente
- mover lead altera estágio
- campanha é persistida

### B. Teste de erro previsível
Exemplo:
- workspace inválido
- lead sem campo obrigatório
- campanha sem nome
- falha na IA

### C. Teste de regressão do fluxo afetado
Exemplo:
- ao adicionar campos personalizados, criação básica de lead não pode quebrar
- ao adicionar envio simulado, geração de mensagens não pode parar de funcionar

## 12.2 Ordem de validação recomendada

1. teste unitário quando a lógica for isolável
2. teste de integração para regras de banco ou edge function
3. teste manual guiado para fluxo visual

## 12.3 Casos que exigem muito cuidado

Criar testes específicos para:

- isolamento por workspace
- validação de campos obrigatórios por etapa
- geração de mensagens por campanha e lead corretos
- atribuição de responsável apenas a membro do workspace
- persistência correta de campos personalizados
- movimentação para “Tentando Contato” no envio simulado

## 12.4 Obrigação processual do Codex

Ao terminar qualquer implementação, você deve registrar explicitamente:

- o que foi implementado
- quais testes foram adicionados ou executados
- quais bugs foram corrigidos
- quais riscos ainda existem

## 12.5 Validações obrigatórias de Lovable, commits e Vercel

Além dos testes funcionais de cada feature:

- após cada bloco importante de frontend gerado ou refinado a partir do Lovable, executar teste funcional básico da interface
- antes de cada commit, validar os principais fluxos afetados para evitar registrar código quebrado
- antes de cada commit, confirmar que não há secrets em arquivos rastreados
- antes da entrega, validar a aplicação publicada na Vercel
- na validação final da Vercel, checar build, rotas principais, variáveis de ambiente, autenticação, Edge Function de IA, integração com Supabase e ausência de erros críticos de console

---

# 13. CRITÉRIOS DE QUALIDADE DE CÓDIGO

## 13.1 Legibilidade

- nomes claros
- funções curtas quando possível
- evitar arquivos gigantes desnecessários
- evitar duplicação onde for fácil corrigir

## 13.2 Tipagem

- preferir TypeScript consistente
- evitar `any` sem justificativa
- centralizar tipos de domínio importantes

## 13.3 Tratamento de erro

- nunca falhar silenciosamente
- nunca mostrar erro técnico cru ao usuário final se puder ser traduzido
- manter logs técnicos no lugar certo e UI com mensagens humanas

## 13.4 Organização

Estrutura sugerida:

```text
src/
  app/
  components/
  features/
    auth/
    workspaces/
    leads/
    pipeline/
    campaigns/
    messages/
    dashboard/
  lib/
  services/
  hooks/
  types/
  utils/
  pages/
```

A estrutura pode variar, mas deve permanecer previsível.

---

# 14. UX MÍNIMA ESPERADA

A interface não precisa ser espetacular. Precisa ser clara.

## 14.1 Prioridades de UX

- fluxo fácil de demonstrar
- estados de loading
- estados vazios
- mensagens de sucesso e erro
- navegação previsível
- telas sem ambiguidade

## 14.2 Telas mínimas esperadas

- login / cadastro
- onboarding ou criação de workspace
- dashboard
- leads / kanban
- detalhe ou edição do lead
- campanhas
- geração de mensagens

## 14.3 Estados vazios obrigatórios

- sem leads
- sem campanhas
- sem mensagens geradas
- dashboard vazio

---

# 15. INTEGRAÇÃO COM IA — DIRETRIZES

## 15.1 Objetivo da IA

Gerar mensagens personalizadas de abordagem usando:

- contexto da campanha
- prompt da campanha
- dados do lead
- campos personalizados relevantes

## 15.2 Regras de montagem de prompt

A montagem do prompt deve ser clara, previsível e auditável.

Estrutura recomendada:

1. instrução do sistema
2. contexto da campanha
3. objetivo da tarefa
4. dados do lead em formato estruturado
5. restrições de saída

## 15.3 Saída esperada

A edge function deve buscar retorno em formato previsível, de preferência JSON estruturado ou separação confiável das mensagens.

Exemplo de intenção:

- 3 mensagens
- cada uma com texto objetivo
- sem markdown desnecessário
- tamanho controlado

## 15.4 Tratamento de falhas

Se o provedor falhar:

- não quebrar a aplicação
- exibir mensagem clara
- permitir tentar novamente
- registrar erro de forma segura

## 15.5 Custo e simplicidade

Usar prompts econômicos e objetivos. Não construir cadeias complexas desnecessárias.

---

# 16. FUNÇÕES DE BORDA (EDGE FUNCTIONS) — REGRAS

## 16.1 Toda edge function deve

- validar autenticação
- validar entrada com schema
- verificar membership do workspace
- nunca confiar em IDs vindos do cliente sem checagem
- tratar erros com status coerentes
- retornar payload claro

## 16.2 Padrão mínimo de resposta

Retornar algo como:

- `success: true/false`
- `data` quando sucesso
- `error` com mensagem segura quando falha

## 16.3 Funções sugeridas

- `generate-lead-messages`
- opcionalmente no futuro: `trigger-campaign-generation`

---

# 17. ESTRATÉGIA DE COMMITS

Commits são obrigatórios durante toda a evolução do projeto.

Não é aceitável desenvolver tudo e commitar apenas no final. O histórico precisa demonstrar progressão real do desenvolvimento, com entregas verificáveis por etapa.

## 17.1 Frequência obrigatória

Fazer commit sempre que houver:

- etapa funcional concluída
- correção relevante de bug
- refatoração importante
- ajuste de segurança
- marco de integração
- documentação estrutural atualizada
- preparação ou correção de deploy

Cada commit deve ser pequeno ou médio, rastreável e semanticamente claro.

## 17.2 Validação antes de commit

Antes de cada commit:

- validar os principais fluxos afetados
- rodar os testes relevantes para a área tocada
- garantir que o app não está em estado quebrado
- conferir que nenhum secret, token, `.env` real, print privado ou dado sensível será rastreado
- registrar somente mudanças coerentes com a mensagem do commit

## 17.3 Mensagens obrigatoriamente claras

Exemplos bons:

- `feat(auth): implementa login e cadastro com Supabase Auth`
- `feat(leads): adiciona CRUD inicial de leads por workspace`
- `feat(campaigns): cria formulário de campanha com contexto e prompt`
- `fix(pipeline): corrige validação de campos obrigatórios na mudança de etapa`
- `refactor(ui): reorganiza estrutura da tela de lead details`
- `chore(deploy): ajusta variáveis de ambiente para produção na Vercel`
- `docs(readme): documenta arquitetura, setup e fluxo principal`

Também são aceitáveis, quando aderentes ao que foi feito:

- `feat(workspaces): cria workspace inicial e membership do owner`
- `feat(ai): adiciona edge function de geração de mensagens`
- `test(pipeline): adiciona validação de campos obrigatórios por etapa`

Nunca fazer commit com mensagens vagas como:

- `update`
- `fixes`
- `ajustes`
- `coisas`
- `wip` sem contexto

---

# 18. REGRAS PARA README FINAL

O README deve convencer o avaliador de que houve pensamento técnico, não só geração automática de código.

## 18.1 O README deve conter

- visão geral do projeto
- stack usada
- arquitetura resumida
- decisões técnicas principais
- explicação do multi-tenancy
- explicação da integração com IA
- instruções de setup
- instruções de env
- fluxo principal de uso
- lista do que foi implementado
- lista do que não foi implementado por priorização
- link da aplicação publicada na Vercel
- link do vídeo

## 18.2 O README deve evitar

- texto genérico demais
- prometer o que não foi entregue
- expor segredos
- parecer copiado sem aderência ao projeto real

---

# 19. REGRAS PARA O VÍDEO DE DEMONSTRAÇÃO

Embora o vídeo possa ser produzido depois, o sistema deve ser pensado para facilitar a demo.

## 19.1 Fluxo de demonstração ideal

Mostrar em sequência:

1. cadastro/login
2. visão do workspace
3. dashboard básico
4. criação de lead
5. visualização no kanban
6. criação de campanha
7. geração de mensagens com IA
8. envio simulado
9. lead movido para “Tentando Contato”
10. comentários sobre decisões técnicas

## 19.2 A demo deve ser robusta

Preparar dados de exemplo e evitar depender de improviso.

---

# 20. NÃO FAÇA

O Codex está proibido de:

- empilhar features sem testes mínimos
- usar dados reais do usuário
- criar backend inseguro que confie plenamente no cliente
- colocar lógica crítica apenas na UI se ela impacta segurança
- priorizar visual antes de funcionalidade obrigatória
- adicionar integrações que não ajudam na prova
- esconder limitações do projeto
- fabricar documentação falsa
- fingir que implementou algo que não implementou

---

# 21. CHECKLIST DE PRONTO POR FEATURE

Antes de considerar uma etapa concluída, confirme:

- [ ] requisito entendido
- [ ] impacto de segurança avaliado
- [ ] modelagem conferida
- [ ] implementação mínima correta feita
- [ ] tipos consistentes
- [ ] tratamento de erro presente
- [ ] teste de lógica feito
- [ ] teste de erro feito
- [ ] teste de regressão feito
- [ ] documentação atualizada
- [ ] commit descritivo realizado

---

# 22. CHECKLIST FINAL DE ENTREGA

Antes da entrega, revisar tudo abaixo.

## Produto
- [ ] cadastro e login funcionam
- [ ] workspace funcional
- [ ] leads funcionam
- [ ] kanban funcional
- [ ] campanhas funcionam
- [ ] IA gera mensagens
- [ ] envio simulado move lead
- [ ] dashboard mostra métricas

## Segurança
- [ ] nenhum segredo commitado
- [ ] `.env.example` criado
- [ ] service role key fora do frontend
- [ ] dados fictícios usados na demo
- [ ] isolamento por workspace validado

## Qualidade
- [ ] sem erros gritantes no console
- [ ] loading e erro tratados nas telas principais
- [ ] casos vazios tratados
- [ ] README completo
- [ ] deploy funcional na Vercel
- [ ] produção na Vercel validada com build, rotas, envs e integrações
- [ ] fluxo de demo ensaiado

---

# 23. CRITÉRIO DE PRIORIZAÇÃO EM CASO DE PRAZO CURTO

Se faltar tempo, usar esta ordem de prioridade:

## Prioridade máxima
- auth
- workspace
- leads básicos
- pipeline padrão
- campanhas
- geração com IA
- envio simulado
- dashboard básico
- deploy na Vercel
- README

## Prioridade média
- campos personalizados robustos
- regras refinadas de transição
- UI mais polida
- histórico simples

## Prioridade baixa
- gatilho automático em background
- múltiplos workspaces por usuário
- convites e papéis avançados
- métricas avançadas
- diferenciais sofisticados

Sempre preservar o fluxo principal acima de qualquer diferencial.

---

# 24. DIRETRIZ DE HONESTIDADE TÉCNICA

Em qualquer documentação, commit, comentário ou resposta, seja tecnicamente honesto.

Se algo não foi implementado, diga que não foi.
Se algo está parcial, diga que está parcial.
Se uma decisão foi tomada por prazo, diga isso.

A honestidade técnica aumenta a credibilidade do projeto.

---

# 25. ORDEM OPERACIONAL DE EXECUÇÃO

Siga esta ordem macro sem desviar:

1. preparar base segura do projeto
2. autenticação
3. workspace e membership
4. pipeline padrão
5. CRUD básico de leads
6. campos personalizados
7. kanban
8. validações de transição
9. campanhas
10. edge function de IA
11. envio simulado
12. dashboard
13. revisão final
14. documentação
15. deploy na Vercel
16. validação final ponta a ponta
17. validação final em produção na Vercel

---

# 26. INSTRUÇÃO FINAL AO CODEX

Sua missão é construir este projeto com velocidade, clareza e segurança.

Você deve:

- agir como engenheiro sênior pragmático
- manter o foco no que a prova realmente avalia
- proteger todos os dados do usuário
- nunca vazar segredos
- sempre implementar com validação mínima séria
- criar testes de lógica, bug e regressão para cada funcionalidade criada
- manter o projeto demonstrável e entregável a qualquer momento

## Regra final de execução

A cada nova feature implementada, responda internamente e registre no fluxo de trabalho:

1. o que foi criado
2. quais arquivos foram alterados
3. quais riscos existem
4. quais testes foram feitos
5. quais bugs foram corrigidos
6. qual o próximo passo mais prioritário

Se houver conflito entre beleza e confiabilidade, escolha confiabilidade.
Se houver conflito entre complexidade e prazo, escolha simplicidade robusta.
Se houver conflito entre pressa e segurança, escolha segurança suficiente para entrega profissional.

**Construa este projeto como um MVP técnico sólido, seguro, explicável e publicável.**
