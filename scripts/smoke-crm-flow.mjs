import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  buildSmokeAssignments,
  getSmokeExpectedMetrics,
  getSmokeScenarioByKey,
  validateScenarioConversation,
  validateScenarioThreadSummary,
} from './smoke-flow-lib.mjs';

const AI_FALLBACK_CHAIN = [
  { model: 'gpt-4o-mini', temperature: 0.65, timeoutMs: 18000 },
  { model: 'gpt-4o', temperature: 0.55, timeoutMs: 22000 },
  { model: 'gpt-4.1-mini', temperature: 0.5, timeoutMs: 22000 },
];

const CUSTOM_FIELDS = [
  { name: 'Segmento', field_key: 'segmento', field_type: 'text' },
  { name: 'Porte da empresa', field_key: 'porte_empresa', field_type: 'text' },
  { name: 'Stack comercial', field_key: 'stack_comercial', field_type: 'text' },
  { name: 'Maturidade SDR', field_key: 'maturidade_sdr', field_type: 'text' },
  { name: 'Canal preferencial', field_key: 'canal_preferencial', field_type: 'text' },
  { name: 'Temperatura inicial', field_key: 'temperatura_inicial', field_type: 'text' },
  { name: 'Responsável interno', field_key: 'responsavel_interno', field_type: 'text' },
];

const CAMPAIGNS = [
  {
    slug: 'outbound-icp-operacoes',
    name: 'Outbound ICP Operações e Revenue',
    triggerStage: 'Base',
    channel: 'email',
    context_text:
      'Abordagem consultiva para líderes de operação comercial e revenue que precisam ganhar previsibilidade, reduzir improviso dos SDRs e organizar cadências por segmento.',
    generation_prompt:
      'Criar mensagens curtas, humanas e profissionais. Conectar dor operacional com ganho de previsibilidade e terminar com CTA leve para diagnóstico.',
    goal: 'Abrir conversa consultiva com leads frios de ICP claro.',
  },
  {
    slug: 'reativacao-pipeline-parado',
    name: 'Reativação de pipeline parado',
    triggerStage: 'Tentando Contato',
    channel: 'email',
    context_text:
      'Reativação de leads que já receberam uma abordagem, mas esfriaram por prioridade interna, timing ruim ou falta de clareza sobre impacto comercial.',
    generation_prompt:
      'Retomar contexto sem insistência. Usar uma pergunta curta sobre prioridade, gargalo ou próximo passo possível.',
    goal: 'Reabrir resposta em leads mornos e recuperar timing.',
  },
  {
    slug: 'qualificacao-diagnostico',
    name: 'Qualificação para diagnóstico comercial',
    triggerStage: 'Conexão Iniciada',
    channel: 'whatsapp',
    context_text:
      'Conversa com leads que responderam ou demonstraram interesse e precisam ser qualificados em dor, maturidade do processo, stack e urgência.',
    generation_prompt:
      'Conduzir qualificação com tom direto, sem interrogatório. Fazer uma pergunta por vez e apontar valor prático.',
    goal: 'Transformar interesse em diagnóstico com dados comerciais mínimos.',
  },
  {
    slug: 'avanco-reuniao',
    name: 'Avanço para reunião',
    triggerStage: 'Qualificado',
    channel: 'whatsapp',
    context_text:
      'Convite para reunião com leads qualificados que já entendem a dor e precisam de um próximo passo objetivo para avaliar solução e impacto.',
    generation_prompt:
      'Avançar para reunião com clareza, confiança e baixa fricção. Sugerir agenda e resumir o que será analisado.',
    goal: 'Converter lead qualificado em reunião agendada.',
  },
];

const LEAD_NAMES = [
  ['Mariana Costa', 'AtlasLog'],
  ['Rafael Azevedo', 'NexoCargo'],
  ['Bianca Nogueira', 'Clara Saúde'],
  ['Thiago Leme', 'Pulsar ERP'],
  ['Paula Martins', 'Aurora Ensino'],
  ['Felipe Barros', 'Nova Farma'],
  ['Camila Duarte', 'Vértice Energia'],
  ['Gustavo Prado', 'MobiFleet'],
  ['Juliana Serra', 'OmniBank'],
  ['Rodrigo Telles', 'Lince Logística'],
  ['Larissa Mendonça', 'Senda Transportes'],
  ['Bruno Farias', 'Axis Supply'],
  ['Isabela Pires', 'Delta Chain'],
  ['Marcelo Nunes', 'CargoLink'],
  ['Renata Queiroz', 'Prime Route'],
  ['Diego Vasconcelos', 'TrackFlow'],
  ['Natália Campos', 'Orbita Freight'],
  ['Vinícius Moura', 'Fortex Log'],
  ['Aline Teixeira', 'ViaPorto'],
  ['Eduardo Mattos', 'Vector Cargo'],
  ['Fernanda Rocha', 'GridMove'],
  ['Caio Bernardes', 'FastHaul'],
  ['Tatiane Reis', 'Kargo360'],
  ['Leonardo Afonso', 'Rota Prime'],
  ['Priscila Amaral', 'LogHub'],
  ['Daniel Freitas', 'CoreStack'],
  ['Beatriz Sampaio', 'Synapse CRM'],
  ['Henrique Loureiro', 'Orbit SaaS'],
  ['Luiza Antunes', 'DataFuse'],
  ['Pedro Mello', 'NovaDesk'],
  ['Alice Ribeiro', 'ByteFlow'],
  ['Ricardo Pacheco', 'HiveERP'],
  ['Sofia Goulart', 'OmniTech'],
  ['Matheus Rezende', 'CloudBridge'],
  ['Débora Falcão', 'LeadPilot'],
  ['Gabriel Rios', 'Atlas SaaS'],
  ['Marina Valença', 'SigmaSoft'],
  ['André Silveira', 'Focus ERP'],
  ['Laura Neves', 'Pulse CRM'],
  ['João Pimenta', 'LogicDesk'],
  ['Helena Borges', 'StreamCore'],
  ['Renato Cabral', 'DockData'],
  ['Bruna Tavares', 'FlowSuite'],
  ['César Guimarães', 'SmartLayer'],
  ['Elisa Monteiro', 'BaseCloud'],
  ['Fábio Guedes', 'BeamOps'],
  ['Talita Coelho', 'Nimbi Tech'],
  ['Otávio Brandão', 'K2 Software'],
  ['Vanessa Motta', 'LoopDesk'],
  ['Igor Pacheco', 'Quanta SaaS'],
  ['Patrícia Linhares', 'Aurora Ensino'],
  ['Mauro Cezar', 'VidaPlena Saúde'],
  ['Carol Furtado', 'Colégio Horizonte'],
  ['Felipe Aragão', 'Clínica Soma'],
  ['Silvia Nascimento', 'EduPrime'],
  ['Andréa Viana', 'MedFocus'],
  ['Danilo Peixoto', 'Instituto Prisma'],
  ['Júlia Bastos', 'Cuidar+'],
  ['Marcelo Furtado', 'LearnBridge'],
  ['Roberta Sá', 'Essentia Care'],
  ['Pedro Ottoni', 'UniNorte Digital'],
  ['Isadora Lobo', 'Vitta Saúde'],
  ['Alan Menezes', 'Escola Integra'],
  ['Cíntia Mota', 'HealthFirst'],
  ['Renan Lisboa', 'Campus Now'],
  ['Mirela Pacheco', 'OdontoPrime'],
  ['Sérgio Arruda', 'Alfa Educação'],
  ['Evelin Torres', 'Nexo Clínicas'],
  ['Rafael Motta', 'Saber+'],
  ['Luciana Prado', 'BemCare'],
  ['Guilherme Neri', 'EduLab'],
  ['Monique Barreto', 'Vida Integral'],
  ['Tiago Carvalho', 'MedSignal'],
  ['Daniela Porto', 'Colégio Vertex'],
  ['Bruno Accioly', 'CarePath'],
  ['Ana Clara Ramos', 'UrbanFit Franquias'],
  ['Thiago Bittencourt', 'Rede Mais Varejo'],
  ['Larissa Figueiredo', 'CredNova'],
  ['Eduardo Siqueira', 'FortePay'],
  ['Flávia Moraes', 'IndusPrime'],
  ['Marcelo Tavares', 'FranqConnect'],
  ['Juliana Paes', 'OmniRetail'],
  ['Roberto Simões', 'Capital Axis'],
  ['Débora Lins', 'Varejo Sul'],
  ['Vinícius Braga', 'Nexa Finance'],
  ['Amanda Queiroz', 'StoreGrid'],
  ['Leandro Amaral', 'Prisma Capital'],
  ['Aline Barroso', 'Retail One'],
  ['César Tavares', 'Master Franquias'],
  ['Mariana Pacheco', 'CredPoint'],
  ['Rodrigo Leal', 'IndusMax'],
  ['Nathalia Cunha', 'UrbanBox'],
  ['Diego Rocha', 'FinCore'],
  ['Paula Teodoro', 'Fábrica Alpha'],
  ['Gustavo Noronha', 'Retail Hub'],
  ['Elisa Correia', 'Selo Finance'],
  ['Bruno Salgado', 'OmniFranquias'],
  ['Camila Manso', 'Vitta Crédito'],
  ['Fernando Reis', 'Indústria Sigma'],
  ['Raquel Telles', 'Loja Forte'],
];

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const entries = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    entries[key] = value;
  }

  return entries;
}

function requireEnv(env, key) {
  const value = env[key];
  if (!value) throw new Error(`Variável obrigatória ausente: ${key}`);
  return value;
}

function normalizeStageName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isoHoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryableSupabaseError(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  return message.includes('fetch failed') || message.includes('network') || message.includes('timeout') || message.includes('temporarily');
}

async function withSupabaseRetry(label, operation, attempts = 4) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let result;
    try {
      result = await operation();
    } catch (error) {
      result = { data: null, error };
    }

    if (!result.error) return result;

    lastError = result.error;
    if (!retryableSupabaseError(lastError) || attempt === attempts) break;
    await sleep(750 * attempt);
  }

  throw new Error(`${label}: ${lastError?.message ?? lastError ?? 'erro desconhecido'}`);
}

function stageIdByName(stageMap, name) {
  const stage = stageMap.get(normalizeStageName(name));
  if (!stage) throw new Error(`Etapa não encontrada: ${name}`);
  return stage.id;
}

function safeSlug(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createToken() {
  return randomBytes(32).toString('base64url');
}

function segmentForIndex(index) {
  if (index < 25) return 'Logística e Supply Chain';
  if (index < 50) return 'SaaS B2B e Tecnologia';
  if (index < 75) return 'Saúde e Educação';
  return 'Varejo, Franquias, Finanças e Indústria';
}

function stageForIndex(index) {
  if (index < 25) return 'Base';
  if (index < 40) return 'Lead Mapeado';
  if (index < 60) return 'Tentando Contato';
  if (index < 75) return 'Conexão Iniciada';
  if (index < 85) return 'Qualificado';
  if (index < 90) return 'Reunião Agendada';
  return 'Desqualificado';
}

function leadSourceForIndex(index) {
  const sources = [
    'Lista ICP 2026',
    'LinkedIn Sales Navigator',
    'Webinar de geração de pipeline',
    'Indicação de cliente',
    'Evento comercial B2B',
    'Inbound orgânico',
  ];
  return sources[index % sources.length];
}

function jobTitleForIndex(index) {
  const titles = [
    'Head de Revenue Operations',
    'Gerente de SDR',
    'Diretora Comercial',
    'Coordenador de Pré-vendas',
    'Sales Ops Manager',
    'Gerente de Crescimento',
    'Head de Vendas',
    'Líder de Desenvolvimento de Negócios',
  ];
  return titles[index % titles.length];
}

function leadProfile(index, name, company) {
  const segmento = segmentForIndex(index);
  const maturidades = ['Estruturando SDR', 'Time em expansão', 'Operação madura', 'Playbook em revisão', 'Sem cadência formal'];
  const stacks = ['HubSpot + Apollo', 'Pipedrive + WhatsApp', 'Salesforce + Outreach', 'CRM próprio + planilhas', 'RD Station + Ramper'];
  const portes = ['51-100 colaboradores', '101-200 colaboradores', '201-500 colaboradores', '501-1000 colaboradores', '1001+ colaboradores'];
  const temperaturas = ['frio', 'morno', 'interessado', 'positivo', 'objeção ativa'];
  const canais = ['email', 'whatsapp', 'linkedin'];
  const emailDomain = `${safeSlug(company)}.com.br`;
  const phoneSuffix = String(11000000 + index * 7391).slice(-8);

  return {
    slug: safeSlug(`${name}-${company}`),
    name,
    company,
    email: `${safeSlug(name).replace(/-/g, '.')}@${emailDomain}`,
    phone: index % 7 === 0 ? null : `11${phoneSuffix}`,
    job_title: jobTitleForIndex(index),
    lead_source: leadSourceForIndex(index),
    notes: `${company} tem sinais de dor em cadência, visibilidade de pipeline e padronização da abordagem SDR.`,
    segmento,
    porte_empresa: portes[index % portes.length],
    stack_comercial: stacks[index % stacks.length],
    maturidade_sdr: maturidades[index % maturidades.length],
    canal_preferencial: canais[index % canais.length],
    temperatura_inicial: temperaturas[index % temperaturas.length],
    responsavel_interno: ['Álvaro Martins', 'SDR Expert IA', 'Operação Comercial'][index % 3],
    stageName: stageForIndex(index),
    createdAt: isoHoursAgo(220 - index),
  };
}

function buildConversationPrompt({ lead, campaign, scenarioProfile }) {
  const targetMessages = scenarioProfile.sequence.length;
  const sequenceInstructions = scenarioProfile.sequence
    .map((step, index) => {
      const purposePart = step.direction === 'outbound' ? ` / prompt_purpose=${step.promptPurpose}` : '';
      const sentimentPart = step.expectedSentiment ? ` / sentimento=${step.expectedSentiment}` : '';
      return `${index + 1}. ${step.direction}${purposePart}${sentimentPart}: ${step.guidance}`;
    })
    .join('\n');

  return [
    'Você vai gerar uma conversa B2B realista para um CRM SDR brasileiro.',
    'A conversa precisa parecer uma operação real em andamento, não um exemplo genérico.',
    'Retorne somente JSON válido. Não use markdown.',
    `Gere exatamente ${targetMessages} mensagens seguindo a sequencia obrigatoria de direcoes abaixo.`,
    'Use português do Brasil com acentuação correta, tom profissional, humano e sem exagero.',
    'Não invente dados sensíveis. Use apenas os dados do lead e campanha fornecidos.',
    'Cada mensagem deve ter no máximo 420 caracteres.',
    'Formato obrigatório: {"messages":[{"direction":"outbound|inbound","sender_name":"...","message_text":"...","sentiment_tag":"positive|neutral|negative|mixed","intent_tag":"..."}]}',
    `Cenário alvo: ${scenarioProfile.label}`,
    `Descrição operacional: ${scenarioProfile.description}`,
    `Resultado esperado: status=${scenarioProfile.threadStatus}, sentimento=${scenarioProfile.threadSentiment}, etapa_final=${scenarioProfile.resultStageName}`,
    'Sequência obrigatória:',
    sequenceInstructions,
    'Não altere a ordem das mensagens nem troque outbound por inbound.',
    `Lead: ${JSON.stringify(lead)}`,
    `Campanha: ${JSON.stringify({
      name: campaign.name,
      channel: campaign.channel,
      context_text: campaign.context_text,
      generation_prompt: campaign.generation_prompt,
      goal: campaign.goal,
    })}`,
  ].join('\n\n');
}

function parseConversation(content, scenarioProfile) {
  const parsed = JSON.parse(content ?? '{}');
  const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
  const normalized = messages
    .map((message, index) => {
      const direction = scenarioProfile.sequence[index]?.direction ?? (message.direction === 'inbound' || message.direction === 'outbound' ? message.direction : 'outbound');
      const sentiment = ['positive', 'neutral', 'negative', 'mixed'].includes(message.sentiment_tag) ? message.sentiment_tag : 'neutral';
      return {
        direction,
        sender_name: direction === 'outbound' ? 'SDR Expert' : String(message.sender_name ?? 'Cliente').trim(),
        message_text: String(message.message_text ?? '').trim(),
        sentiment_tag: sentiment,
        intent_tag: String(message.intent_tag ?? 'follow_up').trim().slice(0, 80),
      };
    })
    .filter((message) => message.message_text.length > 0)
    .slice(0, scenarioProfile.sequence.length);

  validateScenarioConversation(normalized, scenarioProfile.key);
  return normalized;
}

async function callOpenAiConversation(openAiKey, prompt, scenarioProfile) {
  let lastError = 'Falha desconhecida no provedor de IA.';

  for (const attempt of AI_FALLBACK_CHAIN) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), attempt.timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: attempt.model,
          temperature: attempt.temperature,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Retorne somente JSON válido com conversas comerciais realistas. Todos os textos devem estar em português do Brasil com acentuação correta.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        lastError = `Modelo ${attempt.model} retornou HTTP ${response.status}.`;
        if (response.status !== 401 && response.status !== 403) continue;
        throw new Error(lastError);
      }

      const completion = await response.json();
      const content = completion.choices?.[0]?.message?.content;
      return {
        messages: parseConversation(content, scenarioProfile),
        model: attempt.model,
        usage: completion.usage ?? null,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(lastError);
}

async function callEdgeConversation({ supabaseUrl, supabaseAnonKey, authToken, workspaceId, lead, campaign, scenarioProfile, wave }) {
  let lastError = 'Falha desconhecida na Edge Function de smoke.';

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/generate-smoke-conversation`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'content-type': 'application/json',
        'x-sdr-auth-token': authToken,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        wave,
        scenario: scenarioProfile.label,
        scenario_profile: scenarioProfile,
        lead,
        campaign: {
          name: campaign.name,
          channel: campaign.channel,
          context_text: campaign.context_text,
          generation_prompt: campaign.generation_prompt,
          goal: campaign.goal,
        },
      }),
    }).catch((error) => ({ ok: false, status: 0, json: async () => ({ error: error.message }) }));

    const data = await response.json().catch(() => null);

    if (response.ok && data?.success && data?.data) {
      try {
        return {
          messages: parseConversation(JSON.stringify({ messages: data.data.messages }), scenarioProfile),
          model: data.data.model ?? 'supabase-edge-openai',
          usage: data.data.usage ?? null,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'A Edge Function retornou uma conversa inválida.';
        if (attempt === 4) break;
        await sleep(1200 * attempt);
        continue;
      }
    }

    lastError = `Falha na Edge Function de smoke: HTTP ${response.status} ${data?.error ?? data?.message ?? ''}`.trim();
    if (![0, 429, 502, 503, 504].includes(response.status) || attempt === 4) break;
    await sleep(1200 * attempt);
  }

  throw new Error(lastError);
}

async function generateConversation({ supabaseUrl, supabaseAnonKey, authToken, workspaceId, openAiKey, lead, campaign, scenarioProfile, wave }) {
  if (openAiKey) {
    return callOpenAiConversation(openAiKey, buildConversationPrompt({ lead, campaign, scenarioProfile }), scenarioProfile);
  }

  return callEdgeConversation({ supabaseUrl, supabaseAnonKey, authToken, workspaceId, lead, campaign, scenarioProfile, wave });
}

async function getOrCreateWorkspace(client, workspaceName) {
  const { data: existingWorkspace, error: existingWorkspaceError } = await client
    .from('workspaces')
    .select('*')
    .eq('name', workspaceName)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingWorkspaceError) throw new Error(`Falha ao buscar workspace do smoke: ${existingWorkspaceError.message}`);
  if (existingWorkspace) return existingWorkspace;

  const { data, error } = await client.rpc('create_workspace_with_defaults', { workspace_name: workspaceName });
  if (error) throw new Error(`Falha ao criar workspace do smoke: ${error.message}`);
  if (!data) throw new Error('RPC create_workspace_with_defaults não retornou workspace.');
  return data;
}

async function resetWorkspaceData(client, workspaceId) {
  const deletePlans = [
    ['conversation_simulation_tokens', 'tokens do simulador'],
    ['conversation_messages', 'mensagens de conversas'],
    ['conversation_threads', 'conversas simuladas'],
    ['sent_message_events', 'histórico de mensagens'],
    ['generated_messages', 'mensagens geradas'],
    ['lead_custom_field_values', 'valores de campos personalizados'],
    ['stage_required_fields', 'regras por etapa'],
    ['campaigns', 'campanhas'],
    ['leads', 'leads'],
    ['workspace_custom_fields', 'campos personalizados'],
  ];

  for (const [table, label] of deletePlans) {
    const { error } = await client.from(table).delete().eq('workspace_id', workspaceId);
    if (error) throw new Error(`Falha ao limpar ${label}: ${error.message}`);
  }
}

async function loadStages(client, workspaceId) {
  const { data, error } = await client
    .from('pipeline_stages')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true });

  if (error || !data?.length) throw new Error(`Falha ao carregar etapas: ${error?.message ?? 'sem etapas'}`);
  return data;
}

async function createCustomFields(client, workspaceId) {
  const rows = CUSTOM_FIELDS.map((field) => ({ workspace_id: workspaceId, ...field }));
  const { data, error } = await client.from('workspace_custom_fields').insert(rows).select();
  if (error || !data) throw new Error(`Falha ao criar campos personalizados: ${error?.message ?? 'sem retorno'}`);
  return new Map(data.map((field) => [field.field_key, field]));
}

async function saveStageRequiredFields(client, workspaceId, stageMap, customFieldMap) {
  const rows = [
    ['Lead Mapeado', 'company', null],
    ['Lead Mapeado', 'job_title', null],
    ['Lead Mapeado', 'lead_source', null],
    ['Lead Mapeado', null, 'segmento'],
    ['Conexão Iniciada', 'email', null],
    ['Conexão Iniciada', null, 'canal_preferencial'],
    ['Qualificado', 'phone', null],
    ['Qualificado', 'assigned_user_id', null],
    ['Qualificado', null, 'maturidade_sdr'],
    ['Reunião Agendada', 'notes', null],
    ['Reunião Agendada', null, 'stack_comercial'],
  ]
    .map(([stageName, fieldKey, customKey]) => ({
      workspace_id: workspaceId,
      stage_id: stageIdByName(stageMap, stageName),
      field_key: fieldKey,
      custom_field_id: customKey ? customFieldMap.get(customKey)?.id ?? null : null,
    }))
    .filter((row) => row.field_key || row.custom_field_id);

  const { error } = await client.from('stage_required_fields').insert(rows);
  if (error) throw new Error(`Falha ao criar regras por etapa: ${error.message}`);
}

async function createCampaigns(client, workspaceId, userId, stageMap) {
  const rows = CAMPAIGNS.map((campaign, index) => ({
    workspace_id: workspaceId,
    name: campaign.name,
    context_text: campaign.context_text,
    generation_prompt: campaign.generation_prompt,
    trigger_stage_id: stageIdByName(stageMap, campaign.triggerStage),
    is_active: true,
    created_by: userId,
    created_at: isoHoursAgo(110 - index),
    updated_at: isoHoursAgo(100 - index),
  }));

  const { data, error } = await client.from('campaigns').insert(rows).select();
  if (error || !data) throw new Error(`Falha ao criar campanhas: ${error?.message ?? 'sem retorno'}`);
  return new Map(
    CAMPAIGNS.map((campaign) => {
      const record = data.find((item) => item.name === campaign.name);
      return [campaign.slug, record ? { ...record, slug: campaign.slug, channel: campaign.channel, goal: campaign.goal } : null];
    }),
  );
}

async function createLeads(client, workspaceId, userId, stageMap) {
  const profiles = LEAD_NAMES.map(([name, company], index) => leadProfile(index, name, company));
  const rows = profiles.map((lead) => ({
    workspace_id: workspaceId,
    current_stage_id: stageIdByName(stageMap, lead.stageName),
    assigned_user_id: userId,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    job_title: lead.job_title,
    lead_source: lead.lead_source,
    notes: lead.notes,
    created_by: userId,
    created_at: lead.createdAt,
    updated_at: lead.createdAt,
  }));

  const { data, error } = await client.from('leads').insert(rows).select();
  if (error || !data) throw new Error(`Falha ao criar leads: ${error?.message ?? 'sem retorno'}`);

  const leadMap = new Map();
  for (const profile of profiles) {
    const record = data.find((lead) => lead.name === profile.name && lead.company === profile.company);
    if (!record) throw new Error(`Lead não encontrado após insert: ${profile.name}`);
    leadMap.set(profile.slug, { record, profile });
  }

  return { leadMap, profiles };
}

async function saveLeadCustomValues(client, workspaceId, leadMap, customFieldMap) {
  const rows = [];
  for (const { record, profile } of leadMap.values()) {
    for (const field of CUSTOM_FIELDS) {
      rows.push({
        workspace_id: workspaceId,
        lead_id: record.id,
        custom_field_id: customFieldMap.get(field.field_key).id,
        value_text: profile[field.field_key],
        created_at: record.created_at,
        updated_at: record.updated_at,
      });
    }
  }

  const { error } = await client.from('lead_custom_field_values').insert(rows);
  if (error) throw new Error(`Falha ao salvar valores personalizados: ${error.message}`);
}

async function insertConversation({
  client,
  supabaseUrl,
  supabaseAnonKey,
  authToken,
  workspace,
  userId,
  leadBundle,
  campaign,
  openAiKey,
  wave,
  index,
  stageMap,
  scenarioKey,
  publicBaseUrl,
  delayMs,
}) {
  const { record: lead, profile } = leadBundle;
  const scenarioProfile = getSmokeScenarioByKey(scenarioKey);
  const generated = await generateConversation({
    supabaseUrl,
    supabaseAnonKey,
    authToken,
    workspaceId: workspace.id,
    openAiKey,
    lead: profile,
    campaign,
    scenarioProfile,
    wave,
  });
  validateScenarioConversation(generated.messages, scenarioProfile.key);
  const createdAt = isoHoursAgo(80 - index * 0.7);

  const { data: thread } = await withSupabaseRetry(`Falha ao criar thread para ${lead.name}`, () =>
    client.from('conversation_threads').insert({
      workspace_id: workspace.id,
      lead_id: lead.id,
      campaign_id: campaign.id,
      title: `${lead.name} · ${campaign.name}`,
      channel: campaign.channel,
      status: scenarioProfile.threadStatus,
      sentiment_tag: scenarioProfile.threadSentiment,
      simulation_enabled: true,
      created_by: userId,
      created_at: createdAt,
      updated_at: new Date().toISOString(),
    }).select().single(),
  );

  if (!thread) throw new Error(`Falha ao criar thread para ${lead.name}: sem retorno`);

  let firstOutboundMessageId = null;
  const conversationRows = [];
  const eventRows = [];
  for (const [messageIndex, message] of generated.messages.entries()) {
    const sequenceStep = scenarioProfile.sequence[messageIndex];
    const messageAt = isoHoursAgo(78 - index * 0.7 - messageIndex * 0.3);
    let generatedMessageId = null;

    if (message.direction === 'outbound') {
      const { data: generatedMessage } = await withSupabaseRetry(`Falha ao persistir mensagem gerada para ${lead.name}`, () =>
        client.from('generated_messages').insert({
          workspace_id: workspace.id,
          lead_id: lead.id,
          campaign_id: campaign.id,
          variation_index: Math.min(messageIndex + 1, 3),
          message_text: message.message_text,
          generation_status: 'sent',
          generated_by_user_id: userId,
          created_at: messageAt,
        }).select().single(),
      );
      if (!generatedMessage) throw new Error(`Falha ao persistir mensagem gerada para ${lead.name}: sem retorno`);
      generatedMessageId = generatedMessage.id;
      firstOutboundMessageId ??= generatedMessage.id;
    }

    conversationRows.push({
      workspace_id: workspace.id,
      thread_id: thread.id,
      lead_id: lead.id,
      campaign_id: campaign.id,
      direction: message.direction,
        sender_type: message.direction === 'outbound' ? 'sdr_ai' : 'client',
        sender_name: message.direction === 'outbound' ? 'SDR Expert' : lead.name.split(' ')[0],
        message_text: message.message_text,
        model_name: generated.model,
        prompt_purpose: message.direction === 'outbound' ? sequenceStep.promptPurpose : null,
        sentiment_tag: sequenceStep.expectedSentiment ?? message.sentiment_tag,
        intent_tag: message.intent_tag || sequenceStep.intentTag,
        generated_by: 'openai',
        token_usage: generated.usage,
        created_at: messageAt,
    });

    eventRows.push({
      workspace_id: workspace.id,
      lead_id: lead.id,
      campaign_id: campaign.id,
      generated_message_id: generatedMessageId,
      message_text: message.message_text,
      sent_by_user_id: userId,
      is_simulated: true,
      direction: message.direction,
      sender_name: message.direction === 'outbound' ? 'SDR Expert' : lead.name.split(' ')[0],
      channel: campaign.channel,
      delivery_status: message.direction === 'outbound' ? 'read' : 'replied',
      sent_at: messageAt,
    });
  }

  await withSupabaseRetry(`Falha ao salvar conversa de ${lead.name}`, () => client.from('conversation_messages').insert(conversationRows));

  await withSupabaseRetry(`Falha ao salvar eventos de ${lead.name}`, () => client.from('sent_message_events').insert(eventRows));

  const targetStageId = stageIdByName(stageMap, scenarioProfile.resultStageName);
  await withSupabaseRetry(`Falha ao atualizar etapa do lead ${lead.name}`, () =>
    client
      .from('leads')
      .update({
        current_stage_id: targetStageId,
        updated_at: conversationRows.at(-1)?.created_at ?? new Date().toISOString(),
      })
      .eq('workspace_id', workspace.id)
      .eq('id', lead.id),
  );

  await withSupabaseRetry(`Falha ao atualizar thread ${thread.id}`, () =>
    client
      .from('conversation_threads')
      .update({
        status: scenarioProfile.threadStatus,
        sentiment_tag: scenarioProfile.threadSentiment,
        updated_at: conversationRows.at(-1)?.created_at ?? new Date().toISOString(),
      })
      .eq('workspace_id', workspace.id)
      .eq('id', thread.id),
  );

  const token = createToken();
  await withSupabaseRetry(`Falha ao criar token do simulador para ${lead.name}`, () =>
    client.from('conversation_simulation_tokens').insert({
      workspace_id: workspace.id,
      thread_id: thread.id,
      token_hash: hashToken(token),
      created_by: userId,
    }),
  );

  if (delayMs > 0) await sleep(delayMs);

  return {
    threadId: thread.id,
    leadId: lead.id,
    scenarioKey: scenarioProfile.key,
    model: generated.model,
    generatedCount: generated.messages.length,
    outboundCount: scenarioProfile.sequence.filter((step) => step.direction === 'outbound').length,
    inboundCount: scenarioProfile.sequence.filter((step) => step.direction === 'inbound').length,
    leadStageName: scenarioProfile.resultStageName,
    threadStatus: scenarioProfile.threadStatus,
    threadSentiment: scenarioProfile.threadSentiment,
    leadName: lead.name,
    firstOutboundMessageId,
    simulatorUrl: `${publicBaseUrl.replace(/\/$/, '')}/client-simulator?token=${token}`,
  };
}

async function countTable(client, table, workspaceId) {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId);
  if (error) throw new Error(`Falha ao contar ${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const cwd = process.cwd();
  const env = { ...readEnvFile(path.join(cwd, '.env.local')), ...process.env };
  const supabaseUrl = requireEnv(env, 'VITE_SUPABASE_URL');
  const supabaseAnonKey = requireEnv(env, 'VITE_SUPABASE_ANON_KEY');
  const openAiKey = env.OPENAI_API_KEY?.trim() || '';
  const testUserEmail = requireEnv(env, 'TEST_USER_EMAIL');
  const testUserPassword = requireEnv(env, 'TEST_USER_PASSWORD');
  const workspaceName = env.SMOKE_WORKSPACE_NAME?.trim() || 'Operação SDR Demo';
  const publicBaseUrl = env.SMOKE_PUBLIC_BASE_URL?.trim() || 'https://sdr-crm-ai-wine.vercel.app';
  const delayMs = Number(env.SMOKE_AI_DELAY_MS ?? 500);
  const requestedWave = env.SMOKE_WAVE?.trim() || 'all';
  const threadLimit = Number(env.SMOKE_THREAD_LIMIT ?? 100);

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`0/11 Modo de geração IA: ${openAiKey ? 'OpenAI local com fallback' : 'Supabase Edge Function com secrets remotos'}.`);
  console.log('1/11 Autenticando usuário de teste...');
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword,
  });
  if (authError || !authData.session || !authData.user) {
    throw new Error(`Falha no login do usuário de teste: ${authError?.message ?? 'sessão ausente'}`);
  }

  console.log(`2/11 Garantindo workspace demo "${workspaceName}"...`);
  const workspace = await getOrCreateWorkspace(client, workspaceName);

  console.log('3/11 Limpando dados anteriores do workspace demo...');
  await resetWorkspaceData(client, workspace.id);

  console.log('4/11 Carregando funil e criando estrutura de campos...');
  const stages = await loadStages(client, workspace.id);
  const stageMap = new Map(stages.map((stage) => [normalizeStageName(stage.name), stage]));
  const customFieldMap = await createCustomFields(client, workspace.id);
  await saveStageRequiredFields(client, workspace.id, stageMap, customFieldMap);

  console.log('5/11 Criando 100 leads realistas com distribuição por etapa...');
  const { leadMap, profiles } = await createLeads(client, workspace.id, authData.user.id, stageMap);
  await saveLeadCustomValues(client, workspace.id, leadMap, customFieldMap);

  console.log('6/11 Criando 4 campanhas oficiais da demonstração...');
  const campaignMap = await createCampaigns(client, workspace.id, authData.user.id, stageMap);

  const selectedProfiles = profiles.slice(0, Math.min(threadLimit, profiles.length));
  const scenarioAssignments = buildSmokeAssignments(selectedProfiles.length, requestedWave);
  const expectedMetrics = getSmokeExpectedMetrics(scenarioAssignments);
  const simulatorSamples = [];
  let totalAiMessages = 0;
  const modelUsage = new Map();
  const threadSummaries = [];

  console.log(`7/11 Semeando ${selectedProfiles.length} conversas operacionais com IA real...`);
  for (const [index, profile] of selectedProfiles.entries()) {
    const scenarioKey = scenarioAssignments[index];
    const scenarioProfile = getSmokeScenarioByKey(scenarioKey);
    const leadBundle = leadMap.get(profile.slug);
    const campaign = campaignMap.get(scenarioProfile.campaignSlug);
    if (!leadBundle) throw new Error(`Lead do smoke não encontrado: ${profile.name}`);
    if (!campaign) throw new Error(`Campanha do smoke não encontrada para o cenário ${scenarioProfile.key}.`);

    const result = await insertConversation({
      client,
      supabaseUrl,
      supabaseAnonKey,
      authToken: authData.session.access_token,
      workspace,
      userId: authData.user.id,
      leadBundle,
      campaign,
      openAiKey,
      wave: ['opening_no_response', 'secondary_follow_up_no_response'].includes(scenarioKey) ? 1 : 2,
      index,
      stageMap,
      scenarioKey,
      publicBaseUrl,
      delayMs,
    });
    totalAiMessages += result.generatedCount;
    modelUsage.set(result.model, (modelUsage.get(result.model) ?? 0) + 1);
    threadSummaries.push(result);
    if (simulatorSamples.length < 8) simulatorSamples.push(result.simulatorUrl);
    console.log(`   ${index + 1}/${selectedProfiles.length}: ${profile.name} · ${scenarioProfile.label} · ${result.generatedCount} mensagens · ${result.model}`);
  }

  console.log('8/11 Validando contagens e sequências do cenário completo...');
  const [
    leadCount,
    campaignCount,
    generatedMessageCount,
    eventCount,
    threadCount,
    conversationMessageCount,
    tokenCount,
    reloadedLeadsResult,
    reloadedThreadsResult,
    reloadedConversationMessagesResult,
  ] = await Promise.all([
    countTable(client, 'leads', workspace.id),
    countTable(client, 'campaigns', workspace.id),
    countTable(client, 'generated_messages', workspace.id),
    countTable(client, 'sent_message_events', workspace.id),
    countTable(client, 'conversation_threads', workspace.id),
    countTable(client, 'conversation_messages', workspace.id),
    countTable(client, 'conversation_simulation_tokens', workspace.id),
    client.from('leads').select('id,current_stage_id').eq('workspace_id', workspace.id),
    client.from('conversation_threads').select('id,status,sentiment_tag,lead_id').eq('workspace_id', workspace.id),
    client
      .from('conversation_messages')
      .select('thread_id,direction,prompt_purpose,message_text,created_at')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: true }),
  ]);

  if (leadCount < 100) throw new Error('O smoke não criou os 100 leads esperados.');
  if (campaignCount < 4) throw new Error('O smoke não criou as 4 campanhas esperadas.');
  if (threadCount !== expectedMetrics.threads) throw new Error(`Threads esperadas: ${expectedMetrics.threads}. Encontradas: ${threadCount}.`);
  if (generatedMessageCount !== expectedMetrics.generatedMessages) {
    throw new Error(`Generated messages esperadas: ${expectedMetrics.generatedMessages}. Encontradas: ${generatedMessageCount}.`);
  }
  if (eventCount !== expectedMetrics.sentMessageEvents) {
    throw new Error(`Sent message events esperados: ${expectedMetrics.sentMessageEvents}. Encontrados: ${eventCount}.`);
  }
  if (conversationMessageCount !== expectedMetrics.conversationMessages) {
    throw new Error(`Conversation messages esperadas: ${expectedMetrics.conversationMessages}. Encontradas: ${conversationMessageCount}.`);
  }
  if (tokenCount !== expectedMetrics.threads) throw new Error('Nem todas as conversas receberam token de simulador.');
  if (reloadedLeadsResult.error) throw new Error(`Falha ao recarregar leads: ${reloadedLeadsResult.error.message}`);
  if (reloadedThreadsResult.error) throw new Error(`Falha ao recarregar threads: ${reloadedThreadsResult.error.message}`);
  if (reloadedConversationMessagesResult.error) {
    throw new Error(`Falha ao recarregar mensagens de conversa: ${reloadedConversationMessagesResult.error.message}`);
  }

  const leadsById = new Map((reloadedLeadsResult.data ?? []).map((lead) => [lead.id, lead]));
  const threadsById = new Map((reloadedThreadsResult.data ?? []).map((thread) => [thread.id, thread]));
  const stageNameById = new Map(stages.map((stage) => [stage.id, stage.name]));
  const messagesByThread = new Map();
  for (const message of reloadedConversationMessagesResult.data ?? []) {
    const current = messagesByThread.get(message.thread_id) ?? [];
    current.push(message);
    messagesByThread.set(message.thread_id, current);
  }

  for (const summary of threadSummaries) {
    const thread = threadsById.get(summary.threadId);
    const lead = leadsById.get(summary.leadId);
    if (!thread || !lead) {
      throw new Error(`Thread ou lead não recarregado para ${summary.leadName}.`);
    }

    validateScenarioThreadSummary(
      {
        threadId: summary.threadId,
        threadStatus: thread.status,
        threadSentiment: thread.sentiment_tag,
        leadStageName: stageNameById.get(lead.current_stage_id) ?? 'Etapa desconhecida',
        leadName: summary.leadName,
      },
      summary.scenarioKey,
    );

    validateScenarioConversation(
      (messagesByThread.get(summary.threadId) ?? []).map((message) => ({
        direction: message.direction,
        prompt_purpose: message.prompt_purpose,
        message_text: message.message_text,
      })),
      summary.scenarioKey,
    );
  }

  console.log('9/11 Calculando distribuição por etapa...');
  const { data: reloadedLeads, error: reloadError } = await client.from('leads').select('current_stage_id').eq('workspace_id', workspace.id);
  if (reloadError) throw new Error(`Falha ao recarregar leads: ${reloadError.message}`);
  const stageDistribution = stages.map((stage) => ({
    stage: stage.name,
    count: reloadedLeads.filter((lead) => lead.current_stage_id === stage.id).length,
  }));

  console.log('10/11 Smoke test realista concluído com sucesso.');
  const summary = {
    workspace_id: workspace.id,
    workspace_name: workspace.name,
    leads: leadCount,
    campaigns: campaignCount,
    generated_messages: generatedMessageCount,
    sent_message_events: eventCount,
    conversation_threads: threadCount,
    conversation_messages: conversationMessageCount,
    simulation_tokens: tokenCount,
    ai_messages_generated_now: totalAiMessages,
    model_usage: Object.fromEntries(modelUsage),
    expected_metrics: expectedMetrics,
    scenario_distribution: expectedMetrics.byScenario,
    stage_distribution: stageDistribution,
    simulator_samples: simulatorSamples,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
