import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

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
  if (!value) {
    throw new Error(`Variável obrigatória ausente: ${key}`);
  }
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

function stageIdByName(stageMap, name) {
  const stage = stageMap.get(normalizeStageName(name));
  if (!stage) throw new Error(`Etapa não encontrada: ${name}`);
  return stage.id;
}

async function getOrCreateWorkspace(client, workspaceName) {
  const { data: existingWorkspace, error: existingWorkspaceError } = await client
    .from('workspaces')
    .select('*')
    .eq('name', workspaceName)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingWorkspaceError) {
    throw new Error(`Falha ao buscar workspace do smoke: ${existingWorkspaceError.message}`);
  }

  if (existingWorkspace) return existingWorkspace;

  const { data, error } = await client.rpc('create_workspace_with_defaults', {
    workspace_name: workspaceName,
  });

  if (error) {
    throw new Error(`Falha ao criar workspace do smoke: ${error.message}`);
  }

  if (!data) {
    throw new Error('RPC create_workspace_with_defaults não retornou workspace.');
  }

  return data;
}

async function resetWorkspaceData(client, workspaceId) {
  const deletePlans = [
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
    if (error) {
      throw new Error(`Falha ao limpar ${label} do workspace de smoke: ${error.message}`);
    }
  }
}

async function createCustomFields(client, workspaceId) {
  const rows = [
    { workspace_id: workspaceId, name: 'Segmento', field_key: 'segmento', field_type: 'text' },
    { workspace_id: workspaceId, name: 'Porte da empresa', field_key: 'porte_empresa', field_type: 'text' },
    { workspace_id: workspaceId, name: 'Stack comercial', field_key: 'stack_comercial', field_type: 'text' },
    { workspace_id: workspaceId, name: 'Maturidade SDR', field_key: 'maturidade_sdr', field_type: 'text' },
  ];

  const { data, error } = await client.from('workspace_custom_fields').insert(rows).select();
  if (error || !data) {
    throw new Error(`Falha ao criar campos personalizados do smoke: ${error?.message ?? 'sem retorno'}`);
  }

  return new Map(data.map((field) => [field.field_key, field]));
}

async function saveStageRequiredFields(client, workspaceId, stageMap, customFieldMap) {
  const rows = [
    { workspace_id: workspaceId, stage_id: stageIdByName(stageMap, 'Lead Mapeado'), field_key: 'company', custom_field_id: null },
    { workspace_id: workspaceId, stage_id: stageIdByName(stageMap, 'Lead Mapeado'), field_key: 'job_title', custom_field_id: null },
    { workspace_id: workspaceId, stage_id: stageIdByName(stageMap, 'Lead Mapeado'), field_key: 'lead_source', custom_field_id: null },
    {
      workspace_id: workspaceId,
      stage_id: stageIdByName(stageMap, 'Lead Mapeado'),
      field_key: null,
      custom_field_id: customFieldMap.get('segmento')?.id ?? null,
    },
    { workspace_id: workspaceId, stage_id: stageIdByName(stageMap, 'Qualificado'), field_key: 'email', custom_field_id: null },
    { workspace_id: workspaceId, stage_id: stageIdByName(stageMap, 'Qualificado'), field_key: 'phone', custom_field_id: null },
    { workspace_id: workspaceId, stage_id: stageIdByName(stageMap, 'Qualificado'), field_key: 'assigned_user_id', custom_field_id: null },
    {
      workspace_id: workspaceId,
      stage_id: stageIdByName(stageMap, 'Qualificado'),
      field_key: null,
      custom_field_id: customFieldMap.get('maturidade_sdr')?.id ?? null,
    },
    { workspace_id: workspaceId, stage_id: stageIdByName(stageMap, 'Reunião Agendada'), field_key: 'notes', custom_field_id: null },
    {
      workspace_id: workspaceId,
      stage_id: stageIdByName(stageMap, 'Reunião Agendada'),
      field_key: null,
      custom_field_id: customFieldMap.get('stack_comercial')?.id ?? null,
    },
  ].filter((row) => row.field_key || row.custom_field_id);

  const { error } = await client.from('stage_required_fields').insert(rows);
  if (error) {
    throw new Error(`Falha ao criar regras por etapa do smoke: ${error.message}`);
  }
}

async function createLeads(client, workspaceId, userId, stageMap) {
  const leadSeeds = [
    {
      slug: 'mariana-costa',
      name: 'Mariana Costa',
      email: 'mariana.costa@atlaslog.com.br',
      phone: '11971620011',
      company: 'AtlasLog',
      job_title: 'Head de Revenue Operations',
      lead_source: 'Evento ABM São Paulo',
      notes: 'Quer revisar previsibilidade do funil antes de ampliar o time de SDR.',
      stageName: 'Base',
      updatedAt: isoHoursAgo(2),
    },
    {
      slug: 'rafael-azevedo',
      name: 'Rafael Azevedo',
      email: 'rafael.azevedo@nexocargo.com.br',
      phone: '11988223314',
      company: 'NexoCargo',
      job_title: 'Gerente de SDR',
      lead_source: 'Outbound ICP Operações',
      notes: 'Pediu benchmark de cadência para operação com oito SDRs.',
      stageName: 'Tentando Contato',
      updatedAt: isoHoursAgo(28),
    },
    {
      slug: 'bianca-nogueira',
      name: 'Bianca Nogueira',
      email: 'bianca.nogueira@clarasaude.com.br',
      phone: '21997654018',
      company: 'Clara Saúde',
      job_title: 'Coordenadora Comercial',
      lead_source: 'Indicação de cliente',
      notes: 'Healthtech avaliando padronização de playbooks de pré-vendas.',
      stageName: 'Conexão Iniciada',
      updatedAt: isoHoursAgo(18),
    },
    {
      slug: 'thiago-leme',
      name: 'Thiago Leme',
      email: 'thiago.leme@pulsarerp.com.br',
      phone: '31991337752',
      company: 'Pulsar ERP',
      job_title: 'Diretor Comercial',
      lead_source: 'Parceria de canal',
      notes: 'Já validou dor e quer comparar operação atual com proposta de diagnóstico.',
      stageName: 'Qualificado',
      updatedAt: isoHoursAgo(10),
    },
    {
      slug: 'paula-martins',
      name: 'Paula Martins',
      email: 'paula.martins@auroraensino.com.br',
      phone: '21999884410',
      company: 'Aurora Ensino',
      job_title: 'Sales Ops Manager',
      lead_source: 'Webinar de geração de pipeline',
      notes: 'Reunião de descoberta praticamente alinhada, só falta confirmação final.',
      stageName: 'Reunião Agendada',
      updatedAt: isoHoursAgo(6),
    },
    {
      slug: 'felipe-barros',
      name: 'Felipe Barros',
      email: 'felipe.barros@novafarma.com.br',
      phone: '11990220177',
      company: 'Nova Farma',
      job_title: 'Executivo de Contas',
      lead_source: 'Inbound orgânico',
      notes: 'Entrou no pipeline para mapear estrutura do time e nível de especialização.',
      stageName: 'Lead Mapeado',
      updatedAt: isoHoursAgo(42),
    },
    {
      slug: 'camila-duarte',
      name: 'Camila Duarte',
      email: 'camila.duarte@verticeenergia.com.br',
      phone: '',
      company: 'Vértice Energia',
      job_title: 'BDR Lead',
      lead_source: 'Outbound ICP Energia',
      notes: 'Perdeu timing interno e pediu retorno apenas no próximo trimestre.',
      stageName: 'Desqualificado',
      updatedAt: isoHoursAgo(64),
    },
    {
      slug: 'gustavo-prado',
      name: 'Gustavo Prado',
      email: 'gustavo.prado@mobifleet.com.br',
      phone: '21997334455',
      company: 'MobiFleet',
      job_title: 'Gerente de Receita',
      lead_source: 'Lista ICP 2026',
      notes: 'Operação com time comercial híbrido e CRM ainda pouco disciplinado.',
      stageName: 'Base',
      updatedAt: isoHoursAgo(30),
    },
    {
      slug: 'juliana-serra',
      name: 'Juliana Serra',
      email: 'juliana.serra@omnibank.com.br',
      phone: '',
      company: 'OmniBank',
      job_title: 'Head de Pré-vendas',
      lead_source: 'Outbound setor financeiro',
      notes: 'Interesse alto, mas pediu contexto de ROI antes de abrir agenda.',
      stageName: 'Tentando Contato',
      updatedAt: isoHoursAgo(12),
    },
  ];

  const rows = leadSeeds.map((lead) => ({
    workspace_id: workspaceId,
    current_stage_id: stageIdByName(stageMap, lead.stageName),
    assigned_user_id: userId,
    name: lead.name,
    email: lead.email || null,
    phone: lead.phone || null,
    company: lead.company,
    job_title: lead.job_title,
    lead_source: lead.lead_source,
    notes: lead.notes,
    created_by: userId,
    created_at: lead.updatedAt,
    updated_at: lead.updatedAt,
  }));

  const { data, error } = await client.from('leads').insert(rows).select();
  if (error || !data) {
    throw new Error(`Falha ao criar leads do smoke: ${error?.message ?? 'sem retorno'}`);
  }

  const leadMap = new Map();
  for (const seed of leadSeeds) {
    const record = data.find((lead) => lead.name === seed.name && lead.company === seed.company);
    if (!record) {
      throw new Error(`Lead do smoke não encontrado após insert: ${seed.name}`);
    }
    leadMap.set(seed.slug, record);
  }

  return leadMap;
}

async function saveLeadCustomValues(client, workspaceId, leadMap, customFieldMap) {
  const valueSeeds = [
    ['mariana-costa', { segmento: 'Logística', porte_empresa: '201-500 colaboradores', stack_comercial: 'HubSpot + Apollo', maturidade_sdr: 'Time em expansão' }],
    ['rafael-azevedo', { segmento: 'Logística', porte_empresa: '501-1000 colaboradores', stack_comercial: 'Pipedrive + Ramper', maturidade_sdr: 'Cadência rodando com oito SDRs' }],
    ['bianca-nogueira', { segmento: 'Healthtech', porte_empresa: '101-200 colaboradores', stack_comercial: 'HubSpot + CRM próprio', maturidade_sdr: 'Playbook em revisão' }],
    ['thiago-leme', { segmento: 'ERP', porte_empresa: '201-500 colaboradores', stack_comercial: 'Salesforce + Outreach', maturidade_sdr: 'Operação madura com gestor dedicado' }],
    ['paula-martins', { segmento: 'Edtech', porte_empresa: '51-100 colaboradores', stack_comercial: 'Pipedrive + WhatsApp API', maturidade_sdr: 'Pré-vendas estruturada' }],
    ['felipe-barros', { segmento: 'Farmacêutico', porte_empresa: '1001+ colaboradores', stack_comercial: 'Dynamics + planilhas', maturidade_sdr: 'Mapeando processo atual' }],
    ['camila-duarte', { segmento: 'Energia', porte_empresa: '201-500 colaboradores', stack_comercial: 'HubSpot', maturidade_sdr: 'Sem orçamento no trimestre atual' }],
    ['gustavo-prado', { segmento: 'Mobilidade', porte_empresa: '101-200 colaboradores', stack_comercial: 'Pipedrive + WhatsApp', maturidade_sdr: 'Operação comercial centralizada no gestor' }],
    ['juliana-serra', { segmento: 'Fintech', porte_empresa: '501-1000 colaboradores', stack_comercial: 'Salesforce + Salesloft', maturidade_sdr: 'Time robusto buscando previsibilidade' }],
  ];

  const rows = [];
  for (const [leadSlug, values] of valueSeeds) {
    const lead = leadMap.get(leadSlug);
    if (!lead) continue;

    for (const [fieldKey, valueText] of Object.entries(values)) {
      const field = customFieldMap.get(fieldKey);
      if (!field) continue;

      rows.push({
        workspace_id: workspaceId,
        lead_id: lead.id,
        custom_field_id: field.id,
        value_text: valueText,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
      });
    }
  }

  const { error } = await client.from('lead_custom_field_values').insert(rows);
  if (error) {
    throw new Error(`Falha ao salvar valores dos campos personalizados do smoke: ${error.message}`);
  }
}

async function createCampaigns(client, workspaceId, userId, stageMap) {
  const campaignSeeds = [
    {
      slug: 'outbound-operacoes',
      name: 'Outbound ICP Operações',
      context_text:
        'Abordagem consultiva para líderes de operação comercial que precisam ganhar previsibilidade de pipeline, reduzir improviso do time SDR e estruturar playbooks.',
      generation_prompt:
        'Crie mensagens curtas, elegantes e objetivas em português. Fale com liderança comercial, cite dor operacional e termine com CTA leve para diagnóstico de 20 minutos.',
      trigger_stage_name: 'Base',
      is_active: true,
      updated_at: isoHoursAgo(8),
    },
    {
      slug: 'follow-up-primeiro-toque',
      name: 'Follow-up após primeira abordagem',
      context_text:
        'Sequência para leads que já receberam uma primeira mensagem e precisam de follow-up sem parecer insistente, conectando o contexto à rotina do time de SDR.',
      generation_prompt:
        'Crie follow-ups curtos, humanos e confiantes. Use uma pergunta aberta sobre processo, cadência ou gargalos do funil.',
      trigger_stage_name: 'Tentando Contato',
      is_active: true,
      updated_at: isoHoursAgo(7),
    },
    {
      slug: 'reativacao-morno',
      name: 'Reativação de negociação morna',
      context_text:
        'Campanha para leads que demonstraram interesse, mas esfriaram por conflito de prioridades. O objetivo é retomar a conversa com contexto e urgência moderada.',
      generation_prompt:
        'Crie mensagens de reativação com tom consultivo, lembrando o contexto da dor já mencionada e oferecendo um próximo passo simples.',
      trigger_stage_name: 'Conexão Iniciada',
      is_active: true,
      updated_at: isoHoursAgo(6),
    },
    {
      slug: 'convite-diagnostico',
      name: 'Convite para diagnóstico comercial',
      context_text:
        'Mensagem para leads qualificados que já entendem o valor da solução e estão prontos para marcar uma conversa mais estruturada.',
      generation_prompt:
        'Crie uma mensagem clara, segura e direta convidando para uma reunião diagnóstica com CTA de agenda e menção ao ganho esperado.',
      trigger_stage_name: 'Qualificado',
      is_active: true,
      updated_at: isoHoursAgo(5),
    },
    {
      slug: 'nurturing-antigo',
      name: 'Nurturing institucional legado',
      context_text:
        'Sequência antiga de nutrição usada antes da operação migrar para abordagem consultiva.',
      generation_prompt:
        'Crie mensagens institucionais mais genéricas, sem foco em CTA agressivo.',
      trigger_stage_name: null,
      is_active: false,
      updated_at: isoHoursAgo(90),
    },
  ];

  const rows = campaignSeeds.map((campaign) => ({
    workspace_id: workspaceId,
    name: campaign.name,
    context_text: campaign.context_text,
    generation_prompt: campaign.generation_prompt,
    trigger_stage_id: campaign.trigger_stage_name ? stageIdByName(stageMap, campaign.trigger_stage_name) : null,
    is_active: campaign.is_active,
    created_by: userId,
    created_at: campaign.updated_at,
    updated_at: campaign.updated_at,
  }));

  const { data, error } = await client.from('campaigns').insert(rows).select();
  if (error || !data) {
    throw new Error(`Falha ao criar campanhas do smoke: ${error?.message ?? 'sem retorno'}`);
  }

  const campaignMap = new Map();
  for (const seed of campaignSeeds) {
    const record = data.find((campaign) => campaign.name === seed.name);
    if (!record) {
      throw new Error(`Campanha do smoke não encontrada após insert: ${seed.name}`);
    }
    campaignMap.set(seed.slug, record);
  }

  return campaignMap;
}

async function createManualGeneratedMessages(client, workspaceId, userId, leadMap, campaignMap) {
  const messageSeeds = [
    {
      key: 'rafael-1',
      leadSlug: 'rafael-azevedo',
      campaignSlug: 'follow-up-primeiro-toque',
      variation_index: 1,
      generation_status: 'sent',
      created_at: isoHoursAgo(36),
      message_text:
        'Rafael, olhando a rotina da NexoCargo, fiquei com a impressão de que o gargalo não está na prospecção em si, mas na cadência inconsistente entre os SDRs. Faz sentido para você?',
    },
    {
      key: 'rafael-2',
      leadSlug: 'rafael-azevedo',
      campaignSlug: 'follow-up-primeiro-toque',
      variation_index: 2,
      generation_status: 'generated',
      created_at: isoHoursAgo(34),
      message_text:
        'Rafael, se eu te mostrar em 20 minutos como outros times com operação parecida reduziram tempo de rampagem e melhoraram previsibilidade, vale abrir esse espaço ainda esta semana?',
    },
    {
      key: 'bianca-1',
      leadSlug: 'bianca-nogueira',
      campaignSlug: 'reativacao-morno',
      variation_index: 1,
      generation_status: 'sent',
      created_at: isoHoursAgo(20),
      message_text:
        'Bianca, retomei nosso contexto porque muitas healthtechs estão revisando o processo comercial exatamente agora. Se fizer sentido, eu posso te mandar um case curto focado em organização de playbook e handoff.',
    },
    {
      key: 'bianca-2',
      leadSlug: 'bianca-nogueira',
      campaignSlug: 'reativacao-morno',
      variation_index: 2,
      generation_status: 'generated',
      created_at: isoHoursAgo(18),
      message_text:
        'Bianca, vocês estão olhando mais para cadência, roteamento ou qualidade da primeira abordagem? Se eu souber o foco, consigo te mandar algo mais útil e direto.',
    },
    {
      key: 'thiago-1',
      leadSlug: 'thiago-leme',
      campaignSlug: 'convite-diagnostico',
      variation_index: 1,
      generation_status: 'sent',
      created_at: isoHoursAgo(11),
      message_text:
        'Thiago, como vocês já validaram que o problema é previsibilidade de pipeline, o próximo passo faz mais sentido em formato de diagnóstico. Tenho quarta às 15h ou quinta às 10h. Algum desses horários funciona?',
    },
    {
      key: 'paula-1',
      leadSlug: 'paula-martins',
      campaignSlug: 'convite-diagnostico',
      variation_index: 1,
      generation_status: 'sent',
      created_at: isoHoursAgo(7),
      message_text:
        'Paula, confirmando nossa conversa: posso reservar terça às 10h para o diagnóstico com vocês e te mandar um resumo do que vamos cobrir na reunião.',
    },
    {
      key: 'juliana-1',
      leadSlug: 'juliana-serra',
      campaignSlug: 'follow-up-primeiro-toque',
      variation_index: 1,
      generation_status: 'sent',
      created_at: isoHoursAgo(13),
      message_text:
        'Juliana, percebi que o time da OmniBank já tem volume e stack, mas talvez falte cadência com governança mais clara. Posso te mostrar um exemplo de desenho de operação em 15 minutos?',
    },
    {
      key: 'juliana-2',
      leadSlug: 'juliana-serra',
      campaignSlug: 'follow-up-primeiro-toque',
      variation_index: 2,
      generation_status: 'generated',
      created_at: isoHoursAgo(12),
      message_text:
        'Juliana, se eu te mandar um comparativo simples entre operação reativa e operação com playbook/ritmo mais disciplinado, ajuda na conversa interna com o time?',
    },
  ];

  const rows = messageSeeds.map((seed) => ({
    workspace_id: workspaceId,
    lead_id: leadMap.get(seed.leadSlug).id,
    campaign_id: campaignMap.get(seed.campaignSlug).id,
    variation_index: seed.variation_index,
    message_text: seed.message_text,
    generation_status: seed.generation_status,
    generated_by_user_id: userId,
    created_at: seed.created_at,
  }));

  const { data, error } = await client.from('generated_messages').insert(rows).select();
  if (error || !data) {
    throw new Error(`Falha ao criar mensagens manuais do smoke: ${error?.message ?? 'sem retorno'}`);
  }

  const messageMap = new Map();
  for (const seed of messageSeeds) {
    const record = data.find(
      (message) =>
        message.lead_id === leadMap.get(seed.leadSlug).id &&
        message.campaign_id === campaignMap.get(seed.campaignSlug).id &&
        message.variation_index === seed.variation_index,
    );

    if (!record) {
      throw new Error(`Mensagem manual do smoke não encontrada após insert: ${seed.key}`);
    }
    messageMap.set(seed.key, record);
  }

  return messageMap;
}

async function invokeAiMessages(client, workspaceId, leadId, campaignId) {
  const { data, error } = await client.functions.invoke('generate-lead-messages', {
    body: {
      workspace_id: workspaceId,
      lead_id: leadId,
      campaign_id: campaignId,
    },
  });

  if (error) {
    throw new Error(`Falha ao gerar mensagens pela Edge Function: ${error.message}`);
  }

  const messages = data?.data?.messages ?? [];
  if (!Array.isArray(messages) || messages.length < 2) {
    throw new Error('A Edge Function não retornou mensagens suficientes para validar o cenário do smoke.');
  }

  return {
    messages,
    model: data?.data?.model ?? 'não informado',
  };
}

async function createMessageEvents(client, workspaceId, userId, leadMap, campaignMap, messageMap, aiMessages) {
  const marianaLead = leadMap.get('mariana-costa');
  const marianaCampaign = campaignMap.get('outbound-operacoes');
  const marianaFirstMessage = aiMessages.messages[0];
  const marianaReplyAt = isoHoursAgo(1);

  const rows = [
    {
      workspace_id: workspaceId,
      lead_id: marianaLead.id,
      campaign_id: marianaCampaign.id,
      generated_message_id: marianaFirstMessage.id,
      message_text: marianaFirstMessage.message_text,
      sent_by_user_id: userId,
      is_simulated: true,
      direction: 'outbound',
      sender_name: 'SDR Expert',
      channel: 'email',
      delivery_status: 'read',
      sent_at: isoHoursAgo(1.5),
    },
    {
      workspace_id: workspaceId,
      lead_id: marianaLead.id,
      campaign_id: marianaCampaign.id,
      generated_message_id: null,
      message_text:
        'Oi, vi seu contexto e fez sentido. Pode me mostrar como vocês estruturam governança de cadência sem aumentar o trabalho do gestor?',
      sent_by_user_id: userId,
      is_simulated: true,
      direction: 'inbound',
      sender_name: 'Mariana',
      channel: 'email',
      delivery_status: 'replied',
      sent_at: marianaReplyAt,
    },
    {
      workspace_id: workspaceId,
      lead_id: leadMap.get('rafael-azevedo').id,
      campaign_id: campaignMap.get('follow-up-primeiro-toque').id,
      generated_message_id: messageMap.get('rafael-1').id,
      message_text: messageMap.get('rafael-1').message_text,
      sent_by_user_id: userId,
      is_simulated: true,
      direction: 'outbound',
      sender_name: 'SDR Expert',
      channel: 'whatsapp',
      delivery_status: 'read',
      sent_at: isoHoursAgo(35),
    },
    {
      workspace_id: workspaceId,
      lead_id: leadMap.get('rafael-azevedo').id,
      campaign_id: campaignMap.get('follow-up-primeiro-toque').id,
      generated_message_id: null,
      message_text: 'Gostei do diagnóstico. Se você tiver um case de logística com time de SDR enxuto, me manda que eu levo para o board.',
      sent_by_user_id: userId,
      is_simulated: true,
      direction: 'inbound',
      sender_name: 'Rafael',
      channel: 'whatsapp',
      delivery_status: 'replied',
      sent_at: isoHoursAgo(34),
    },
    {
      workspace_id: workspaceId,
      lead_id: leadMap.get('bianca-nogueira').id,
      campaign_id: campaignMap.get('reativacao-morno').id,
      generated_message_id: messageMap.get('bianca-1').id,
      message_text: messageMap.get('bianca-1').message_text,
      sent_by_user_id: userId,
      is_simulated: true,
      direction: 'outbound',
      sender_name: 'SDR Expert',
      channel: 'linkedin',
      delivery_status: 'delivered',
      sent_at: isoHoursAgo(19),
    },
    {
      workspace_id: workspaceId,
      lead_id: leadMap.get('bianca-nogueira').id,
      campaign_id: campaignMap.get('reativacao-morno').id,
      generated_message_id: null,
      message_text: 'Estamos revisando o processo neste trimestre. Se tiver material com exemplo de healthtech, pode enviar.',
      sent_by_user_id: userId,
      is_simulated: true,
      direction: 'inbound',
      sender_name: 'Bianca',
      channel: 'linkedin',
      delivery_status: 'replied',
      sent_at: isoHoursAgo(17.5),
    },
    {
      workspace_id: workspaceId,
      lead_id: leadMap.get('thiago-leme').id,
      campaign_id: campaignMap.get('convite-diagnostico').id,
      generated_message_id: messageMap.get('thiago-1').id,
      message_text: messageMap.get('thiago-1').message_text,
      sent_by_user_id: userId,
      is_simulated: true,
      direction: 'outbound',
      sender_name: 'SDR Expert',
      channel: 'whatsapp',
      delivery_status: 'read',
      sent_at: isoHoursAgo(10),
    },
    {
      workspace_id: workspaceId,
      lead_id: leadMap.get('paula-martins').id,
      campaign_id: campaignMap.get('convite-diagnostico').id,
      generated_message_id: messageMap.get('paula-1').id,
      message_text: messageMap.get('paula-1').message_text,
      sent_by_user_id: userId,
      is_simulated: true,
      direction: 'outbound',
      sender_name: 'SDR Expert',
      channel: 'whatsapp',
      delivery_status: 'delivered',
      sent_at: isoHoursAgo(6),
    },
    {
      workspace_id: workspaceId,
      lead_id: leadMap.get('paula-martins').id,
      campaign_id: campaignMap.get('convite-diagnostico').id,
      generated_message_id: null,
      message_text: 'Perfeito. Pode confirmar terça às 10h e me mandar o resumo da agenda? Vou envolver meu coordenador de pré-vendas.',
      sent_by_user_id: userId,
      is_simulated: true,
      direction: 'inbound',
      sender_name: 'Paula',
      channel: 'whatsapp',
      delivery_status: 'replied',
      sent_at: isoHoursAgo(5.5),
    },
    {
      workspace_id: workspaceId,
      lead_id: leadMap.get('juliana-serra').id,
      campaign_id: campaignMap.get('follow-up-primeiro-toque').id,
      generated_message_id: messageMap.get('juliana-1').id,
      message_text: messageMap.get('juliana-1').message_text,
      sent_by_user_id: userId,
      is_simulated: true,
      direction: 'outbound',
      sender_name: 'SDR Expert',
      channel: 'email',
      delivery_status: 'read',
      sent_at: isoHoursAgo(11.5),
    },
    {
      workspace_id: workspaceId,
      lead_id: leadMap.get('juliana-serra').id,
      campaign_id: campaignMap.get('follow-up-primeiro-toque').id,
      generated_message_id: null,
      message_text: 'Me envie uma comparação rápida entre o cenário atual e o desenho de cadência sugerido. Se fizer sentido, eu abro uma agenda com o time.',
      sent_by_user_id: userId,
      is_simulated: true,
      direction: 'inbound',
      sender_name: 'Juliana',
      channel: 'email',
      delivery_status: 'replied',
      sent_at: isoHoursAgo(10.5),
    },
  ];

  const { error } = await client.from('sent_message_events').insert(rows);
  if (error) {
    throw new Error(`Falha ao criar histórico de mensagens do smoke: ${error.message}`);
  }
}

async function markMessagesAsSent(client, workspaceId, ids) {
  if (!ids.length) return;

  const { error } = await client
    .from('generated_messages')
    .update({ generation_status: 'sent' })
    .eq('workspace_id', workspaceId)
    .in('id', ids);

  if (error) {
    throw new Error(`Falha ao atualizar status das mensagens do smoke: ${error.message}`);
  }
}

async function moveLeadToContactStage(client, workspaceId, leadId, stageId) {
  const { error } = await client
    .from('leads')
    .update({ current_stage_id: stageId, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', leadId);

  if (error) {
    throw new Error(`Falha ao mover lead do smoke para Tentando Contato: ${error.message}`);
  }
}

async function loadStages(client, workspaceId) {
  const { data, error } = await client
    .from('pipeline_stages')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true });

  if (error || !data?.length) {
    throw new Error(`Falha ao carregar etapas do workspace: ${error?.message ?? 'sem etapas'}`);
  }

  return data;
}

async function countTable(client, table, workspaceId) {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId);
  if (error) throw new Error(`Falha ao contar ${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const cwd = process.cwd();
  const env = {
    ...readEnvFile(path.join(cwd, '.env.local')),
    ...process.env,
  };

  const supabaseUrl = requireEnv(env, 'VITE_SUPABASE_URL');
  const supabaseAnonKey = requireEnv(env, 'VITE_SUPABASE_ANON_KEY');
  const testUserEmail = requireEnv(env, 'TEST_USER_EMAIL');
  const testUserPassword = requireEnv(env, 'TEST_USER_PASSWORD');
  const workspaceName = env.SMOKE_WORKSPACE_NAME?.trim() || 'Operação SDR Demo';

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('1/9 Autenticando usuário de teste...');
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword,
  });

  if (authError || !authData.session || !authData.user) {
    throw new Error(`Falha no login do usuário de teste: ${authError?.message ?? 'sessão ausente'}`);
  }

  console.log(`2/9 Garantindo workspace demo "${workspaceName}"...`);
  const workspace = await getOrCreateWorkspace(client, workspaceName);

  console.log('3/9 Limpando dados anteriores do workspace demo...');
  await resetWorkspaceData(client, workspace.id);

  console.log('4/9 Carregando etapas e estrutura base...');
  const stages = await loadStages(client, workspace.id);
  const stageMap = new Map(stages.map((stage) => [normalizeStageName(stage.name), stage]));
  const contatoStage = stageMap.get('tentando contato');
  if (!contatoStage) {
    throw new Error('Etapa "Tentando Contato" não encontrada no workspace.');
  }

  const customFieldMap = await createCustomFields(client, workspace.id);
  await saveStageRequiredFields(client, workspace.id, stageMap, customFieldMap);

  console.log('5/9 Criando leads realistas com distribuição por estágio...');
  const leadMap = await createLeads(client, workspace.id, authData.user.id, stageMap);
  await saveLeadCustomValues(client, workspace.id, leadMap, customFieldMap);

  console.log('6/9 Criando campanhas e playbooks de demonstração...');
  const campaignMap = await createCampaigns(client, workspace.id, authData.user.id, stageMap);

  console.log('7/9 Gerando mensagens reais da Edge Function para o lead principal...');
  const aiResult = await invokeAiMessages(
    client,
    workspace.id,
    leadMap.get('mariana-costa').id,
    campaignMap.get('outbound-operacoes').id,
  );

  console.log(`Edge Function validada com ${aiResult.messages.length} mensagem(ns). Modelo final: ${aiResult.model}.`);

  console.log('8/9 Semendo histórico rico de mensagens, envios e respostas do cliente...');
  const manualMessageMap = await createManualGeneratedMessages(client, workspace.id, authData.user.id, leadMap, campaignMap);

  await createMessageEvents(client, workspace.id, authData.user.id, leadMap, campaignMap, manualMessageMap, aiResult);

  const sentMessageIds = [
    aiResult.messages[0].id,
    manualMessageMap.get('rafael-1').id,
    manualMessageMap.get('bianca-1').id,
    manualMessageMap.get('thiago-1').id,
    manualMessageMap.get('paula-1').id,
    manualMessageMap.get('juliana-1').id,
  ];
  await markMessagesAsSent(client, workspace.id, sentMessageIds);
  await moveLeadToContactStage(client, workspace.id, leadMap.get('mariana-costa').id, contatoStage.id);
  leadMap.get('mariana-costa').current_stage_id = contatoStage.id;
  leadMap.get('mariana-costa').updated_at = new Date().toISOString();

  console.log('9/9 Validando contagens do cenário...');
  const [leadCount, campaignCount, generatedMessageCount, eventCount] = await Promise.all([
    countTable(client, 'leads', workspace.id),
    countTable(client, 'campaigns', workspace.id),
    countTable(client, 'generated_messages', workspace.id),
    countTable(client, 'sent_message_events', workspace.id),
  ]);

  if (leadCount < 8) throw new Error('O smoke não criou leads suficientes para o cenário realista.');
  if (campaignCount < 4) throw new Error('O smoke não criou campanhas suficientes para o cenário realista.');
  if (generatedMessageCount < 8) throw new Error('O smoke não gerou mensagens suficientes para o cenário realista.');
  if (eventCount < 8) throw new Error('O smoke não criou histórico suficiente para o chat demonstrável.');

  const stageDistribution = stages.map((stage) => ({
    stage: stage.name,
    count: Array.from(leadMap.values()).filter((lead) => lead.current_stage_id === stage.id).length,
  }));

  const summary = {
    workspace_id: workspace.id,
    workspace_name: workspace.name,
    generated_model: aiResult.model,
    custom_fields: customFieldMap.size,
    leads: leadCount,
    campaigns: campaignCount,
    generated_messages: generatedMessageCount,
    sent_message_events: eventCount,
    sample_leads: [
      'Mariana Costa',
      'Rafael Azevedo',
      'Bianca Nogueira',
      'Thiago Leme',
      'Paula Martins',
      'Juliana Serra',
    ],
    stage_distribution: stageDistribution,
  };

  console.log('Smoke test realista concluído com sucesso.');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
