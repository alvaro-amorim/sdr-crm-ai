import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Campaign, Lead, PipelineStage, Workspace, WorkspaceCustomField } from '../types/domain';
import { createWorkspaceWithDefaults } from './crm';

const EVALUATION_WORKSPACE_NAME = 'Avaliacao Tecnica SDR Expert';
const EVALUATION_MARKER = '[evaluation-seed-v1]';

type EvaluationLeadSeed = {
  name: string;
  company: string;
  email: string;
  phone: string;
  jobTitle: string;
  leadSource: string;
  stageName: string;
  technicalOwnerName: string | null;
  customValues: Record<string, string>;
};

type EvaluationCampaignSeed = {
  name: string;
  contextText: string;
  generationPrompt: string;
  triggerStageName: string;
  channel: 'email' | 'whatsapp' | 'linkedin';
};

export type EvaluationStatus = {
  workspace: Workspace | null;
  leads: number;
  campaigns: number;
  threads: number;
  messages: number;
  simulationTokens: number;
  simulatorUrl: string | null;
};

const evaluationCustomFields = [
  { name: 'Segmento', field_key: 'segmento', field_type: 'text' as const },
  { name: 'Maturidade SDR', field_key: 'maturidade_sdr', field_type: 'text' as const },
  { name: 'Canal preferencial', field_key: 'canal_preferencial', field_type: 'text' as const },
  { name: 'Prioridade da conta', field_key: 'prioridade_conta', field_type: 'text' as const },
];

const evaluationStageRules: Array<{
  stageName: string;
  fieldKey: string | null;
  customFieldKey: string | null;
}> = [
  { stageName: 'Lead Mapeado', fieldKey: 'company', customFieldKey: null },
  { stageName: 'Lead Mapeado', fieldKey: null, customFieldKey: 'segmento' },
  { stageName: 'Conexão Iniciada', fieldKey: 'email', customFieldKey: null },
  { stageName: 'Conexão Iniciada', fieldKey: null, customFieldKey: 'canal_preferencial' },
  { stageName: 'Qualificado', fieldKey: 'assigned_user_id', customFieldKey: null },
  { stageName: 'Qualificado', fieldKey: null, customFieldKey: 'maturidade_sdr' },
];

const evaluationLeads: EvaluationLeadSeed[] = [
  {
    name: 'Mariana Costa',
    company: 'AtlasLog',
    email: 'mariana.costa@atlaslog.com.br',
    phone: '11984561234',
    jobTitle: 'Head de Revenue Operations',
    leadSource: 'Lista ICP 2026',
    stageName: 'Base',
    technicalOwnerName: 'Alvaro Martins',
    customValues: {
      segmento: 'Logistica e supply chain',
      maturidade_sdr: 'Estruturando SDR',
      canal_preferencial: 'email',
      prioridade_conta: 'Alta',
    },
  },
  {
    name: 'Rafael Azevedo',
    company: 'NexoCargo',
    email: 'rafael.azevedo@nexocargo.com.br',
    phone: '11983456789',
    jobTitle: 'Gerente de Pre-vendas',
    leadSource: 'LinkedIn Sales Navigator',
    stageName: 'Lead Mapeado',
    technicalOwnerName: 'Marina Costa',
    customValues: {
      segmento: 'Logistica e supply chain',
      maturidade_sdr: 'Playbook em revisao',
      canal_preferencial: 'linkedin',
      prioridade_conta: 'Media',
    },
  },
  {
    name: 'Bianca Nogueira',
    company: 'Clara Saude',
    email: 'bianca.nogueira@clarasaude.com.br',
    phone: '11982347890',
    jobTitle: 'Diretora Comercial',
    leadSource: 'Evento comercial B2B',
    stageName: 'Tentando Contato',
    technicalOwnerName: 'Lucas Prado',
    customValues: {
      segmento: 'Saude e educacao',
      maturidade_sdr: 'Time em expansao',
      canal_preferencial: 'whatsapp',
      prioridade_conta: 'Alta',
    },
  },
  {
    name: 'Alan Menezes',
    company: 'Escola Integra',
    email: 'alan.menezes@escolaintegra.com.br',
    phone: '11981234567',
    jobTitle: 'Head de Vendas',
    leadSource: 'Indicacao de cliente',
    stageName: 'Conexão Iniciada',
    technicalOwnerName: 'Fernanda Lima',
    customValues: {
      segmento: 'Saude e educacao',
      maturidade_sdr: 'Operacao madura',
      canal_preferencial: 'email',
      prioridade_conta: 'Alta',
    },
  },
  {
    name: 'Aline Teixeira',
    company: 'ViaPorto',
    email: 'aline.teixeira@viaporto.com.br',
    phone: '11980111222',
    jobTitle: 'Diretora Comercial',
    leadSource: 'Webinar de geracao de pipeline',
    stageName: 'Qualificado',
    technicalOwnerName: null,
    customValues: {
      segmento: 'Logistica e supply chain',
      maturidade_sdr: 'Operacao madura',
      canal_preferencial: 'whatsapp',
      prioridade_conta: 'Alta',
    },
  },
  {
    name: 'Bruno Accioly',
    company: 'CarePath',
    email: 'bruno.accioly@carepath.com.br',
    phone: '11979998877',
    jobTitle: 'Sales Ops Manager',
    leadSource: 'Inbound organico',
    stageName: 'Reunião Agendada',
    technicalOwnerName: 'Caio Torres',
    customValues: {
      segmento: 'Saude e educacao',
      maturidade_sdr: 'Time em expansao',
      canal_preferencial: 'email',
      prioridade_conta: 'Media',
    },
  },
];

const evaluationCampaign: EvaluationCampaignSeed = {
  name: 'Campanha de exemplo para avaliacao tecnica',
  contextText:
    'Campanha fixa, deterministica e sem IA para deixar o avaliador navegando pelo fluxo principal com rapidez.',
  generationPrompt:
    'Texto fixo de apoio para a interface. Nao usar IA. Esta campanha existe apenas para avaliacao tecnica.',
  triggerStageName: 'Base',
  channel: 'whatsapp',
};

function normalizeStageName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function stageIdByName(stageMap: Map<string, PipelineStage>, stageName: string): string {
  const stage = stageMap.get(normalizeStageName(stageName));
  if (!stage) {
    throw new Error(`Etapa de avaliação não encontrada: ${stageName}.`);
  }
  return stage.id;
}

function getEvaluationLeadNote(company: string): string {
  return `${EVALUATION_MARKER} Lead determinístico para avaliação técnica do workspace ${company}.`;
}

function createToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getEvaluationWorkspace(client: SupabaseClient): Promise<Workspace | null> {
  const { data, error } = await client
    .from('workspaces')
    .select('*')
    .eq('name', EVALUATION_WORKSPACE_NAME)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as Workspace | null) ?? null;
}

async function ensureEvaluationWorkspace(client: SupabaseClient, user: User): Promise<Workspace> {
  const existing = await getEvaluationWorkspace(client);
  if (existing) return existing;
  return createWorkspaceWithDefaults(client, user, EVALUATION_WORKSPACE_NAME);
}

async function loadStages(client: SupabaseClient, workspaceId: string): Promise<Map<string, PipelineStage>> {
  const { data, error } = await client
    .from('pipeline_stages')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true });

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Nenhuma etapa foi encontrada no workspace de avaliação.');

  return new Map((data as PipelineStage[]).map((stage) => [normalizeStageName(stage.name), stage]));
}

async function syncEvaluationSchema(
  client: SupabaseClient,
  workspaceId: string,
  stageMap: Map<string, PipelineStage>,
): Promise<Map<string, WorkspaceCustomField>> {
  const { error: deleteRulesError } = await client.from('stage_required_fields').delete().eq('workspace_id', workspaceId);
  if (deleteRulesError) throw new Error(deleteRulesError.message);

  const { error: deleteFieldsError } = await client.from('workspace_custom_fields').delete().eq('workspace_id', workspaceId);
  if (deleteFieldsError) throw new Error(deleteFieldsError.message);

  const { data: fields, error: insertFieldsError } = await client
    .from('workspace_custom_fields')
    .insert(evaluationCustomFields.map((field) => ({ workspace_id: workspaceId, ...field })))
    .select();

  if (insertFieldsError || !fields) {
    throw new Error(insertFieldsError?.message ?? 'Falha ao criar campos auxiliares de avaliação.');
  }

  const fieldMap = new Map((fields as WorkspaceCustomField[]).map((field) => [field.field_key, field]));
  const ruleRows = evaluationStageRules.map((rule) => ({
    workspace_id: workspaceId,
    stage_id: stageIdByName(stageMap, rule.stageName),
    field_key: rule.fieldKey,
    custom_field_id: rule.customFieldKey ? fieldMap.get(rule.customFieldKey)?.id ?? null : null,
  }));

  const { error: insertRulesError } = await client.from('stage_required_fields').insert(ruleRows);
  if (insertRulesError) throw new Error(insertRulesError.message);

  return fieldMap;
}

async function resetWorkspaceData(client: SupabaseClient, workspaceId: string): Promise<void> {
  const tables = [
    'conversation_simulation_tokens',
    'conversation_messages',
    'conversation_threads',
    'sent_message_events',
    'generated_messages',
    'lead_custom_field_values',
    'stage_required_fields',
    'campaigns',
    'leads',
    'workspace_custom_fields',
  ];

  for (const table of tables) {
    const { error } = await client.from(table).delete().eq('workspace_id', workspaceId);
    if (error) throw new Error(`Falha ao limpar ${table}: ${error.message}`);
  }
}

async function replaceEvaluationLeads(
  client: SupabaseClient,
  workspaceId: string,
  user: User,
  stageMap: Map<string, PipelineStage>,
  fieldMap: Map<string, WorkspaceCustomField>,
): Promise<Lead[]> {
  const { error: deleteLeadsError } = await client.from('leads').delete().eq('workspace_id', workspaceId);
  if (deleteLeadsError) throw new Error(deleteLeadsError.message);

  const rows = evaluationLeads.map((lead, index) => ({
    workspace_id: workspaceId,
    current_stage_id: stageIdByName(stageMap, lead.stageName),
    assigned_user_id: user.id,
    technical_owner_name: lead.technicalOwnerName,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    job_title: lead.jobTitle,
    lead_source: lead.leadSource,
    notes: getEvaluationLeadNote(lead.company),
    created_by: user.id,
    created_at: new Date(Date.now() - (8 - index) * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - (8 - index) * 60 * 60 * 1000).toISOString(),
  }));

  const { data: insertedLeads, error: insertLeadsError } = await client.from('leads').insert(rows).select();
  if (insertLeadsError || !insertedLeads) {
    throw new Error(insertLeadsError?.message ?? 'Falha ao criar leads de avaliação.');
  }

  const leadByName = new Map((insertedLeads as Lead[]).map((lead) => [lead.name, lead]));
  const customValueRows = evaluationLeads.flatMap((lead) => {
    const leadRecord = leadByName.get(lead.name);
    if (!leadRecord) return [];

    return Object.entries(lead.customValues).map(([fieldKey, valueText]) => ({
      workspace_id: workspaceId,
      lead_id: leadRecord.id,
      custom_field_id: fieldMap.get(fieldKey)?.id,
      value_text: valueText,
      created_at: leadRecord.created_at,
      updated_at: leadRecord.updated_at,
    }));
  }).filter((row) => Boolean(row.custom_field_id));

  if (customValueRows.length > 0) {
    const { error: customValuesError } = await client.from('lead_custom_field_values').insert(customValueRows);
    if (customValuesError) throw new Error(customValuesError.message);
  }

  return insertedLeads as Lead[];
}

async function upsertEvaluationCampaign(
  client: SupabaseClient,
  workspaceId: string,
  user: User,
  stageMap: Map<string, PipelineStage>,
): Promise<Campaign> {
  const payload = {
    workspace_id: workspaceId,
    name: evaluationCampaign.name,
    context_text: evaluationCampaign.contextText,
    generation_prompt: evaluationCampaign.generationPrompt,
    trigger_stage_id: stageIdByName(stageMap, evaluationCampaign.triggerStageName),
    ai_response_mode: 'always' as const,
    ai_response_window_start: '09:00',
    ai_response_window_end: '18:00',
    is_active: true,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data: existingCampaign, error: existingError } = await client
    .from('campaigns')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('name', evaluationCampaign.name)
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  const query = existingCampaign
    ? client.from('campaigns').update(payload).eq('id', existingCampaign.id).eq('workspace_id', workspaceId).select().single()
    : client
        .from('campaigns')
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

  const { data, error } = await query;
  if (error || !data) {
    throw new Error(error?.message ?? 'Falha ao criar campanha de avaliação.');
  }

  return data as Campaign;
}

async function seedThreadAndMessages(
  client: SupabaseClient,
  workspace: Workspace,
  user: User,
  lead: Lead,
  campaign: Campaign,
): Promise<string> {
  const { error: deleteThreadsError } = await client.from('conversation_threads').delete().eq('workspace_id', workspace.id);
  if (deleteThreadsError) throw new Error(deleteThreadsError.message);

  const { error: deleteGeneratedError } = await client.from('generated_messages').delete().eq('workspace_id', workspace.id);
  if (deleteGeneratedError) throw new Error(deleteGeneratedError.message);

  const { error: deleteEventsError } = await client.from('sent_message_events').delete().eq('workspace_id', workspace.id);
  if (deleteEventsError) throw new Error(deleteEventsError.message);

  const { data: generatedMessages, error: generatedError } = await client
    .from('generated_messages')
    .insert([
      {
        workspace_id: workspace.id,
        lead_id: lead.id,
        campaign_id: campaign.id,
        variation_index: 1,
        message_text:
          'Oi, Alan. Vi que sua equipe esta revisando o processo comercial. Posso te mostrar em 10 minutos como priorizar leads, registrar respostas e organizar os proximos passos sem depender de planilha?',
        generation_status: 'sent',
        generated_by_user_id: user.id,
      },
      {
        workspace_id: workspace.id,
        lead_id: lead.id,
        campaign_id: campaign.id,
        variation_index: 2,
        message_text:
          'Se fizer sentido, eu preparo um diagnostico curto com gargalos do funil, responsaveis e pontos de retomada.',
        generation_status: 'generated',
        generated_by_user_id: user.id,
      },
    ])
    .select();

  if (generatedError || !generatedMessages?.length) {
    throw new Error(generatedError?.message ?? 'Falha ao gerar mensagens seed da avaliacao.');
  }

  const outboundMessage = generatedMessages.find((message) => message.variation_index === 1);
  if (!outboundMessage) throw new Error('Mensagem outbound da avaliacao nao foi encontrada.');

  const { data: thread, error: threadError } = await client
    .from('conversation_threads')
    .insert({
      workspace_id: workspace.id,
      lead_id: lead.id,
      campaign_id: campaign.id,
      title: `${lead.name} · ${campaign.name}`,
      channel: evaluationCampaign.channel,
      status: 'positive',
      sentiment_tag: 'positive',
      simulation_enabled: true,
      created_by: user.id,
    })
    .select()
    .single();

  if (threadError || !thread) {
    throw new Error(threadError?.message ?? 'Falha ao criar thread seed da avaliacao.');
  }

  const { error: conversationError } = await client.from('conversation_messages').insert([
    {
      workspace_id: workspace.id,
      thread_id: thread.id,
      lead_id: lead.id,
      campaign_id: campaign.id,
      direction: 'outbound',
      sender_type: 'sdr_ai',
      sender_name: 'SDR Expert',
      message_text: outboundMessage.message_text,
      model_name: 'seed',
      prompt_purpose: 'opening',
      sentiment_tag: 'neutral',
      intent_tag: 'opening_outreach',
      generated_by: 'seed',
    },
    {
      workspace_id: workspace.id,
      thread_id: thread.id,
      lead_id: lead.id,
      campaign_id: campaign.id,
      direction: 'inbound',
      sender_type: 'client',
      sender_name: lead.name.split(' ')[0] ?? lead.name,
      message_text:
        'Oi, nao tinha visto a mensagem anterior. Quero entender como voces priorizam os leads e deixam o historico visivel para o time.',
      model_name: 'seed',
      prompt_purpose: 'client_reply',
      sentiment_tag: 'positive',
      intent_tag: 'interested_needs_context',
      generated_by: 'seed',
    },
  ]);

  if (conversationError) throw new Error(conversationError.message);

  const { error: eventsError } = await client.from('sent_message_events').insert([
    {
      workspace_id: workspace.id,
      lead_id: lead.id,
      campaign_id: campaign.id,
      generated_message_id: outboundMessage.id,
      message_text: outboundMessage.message_text,
      sent_by_user_id: user.id,
      is_simulated: true,
      direction: 'outbound',
      sender_name: 'SDR Expert',
      channel: evaluationCampaign.channel,
      delivery_status: 'read',
      sent_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      workspace_id: workspace.id,
      lead_id: lead.id,
      campaign_id: campaign.id,
      generated_message_id: null,
      message_text:
        'Oi, nao tinha visto a mensagem anterior. Quero entender como voces priorizam os leads e deixam o historico visivel para o time.',
      sent_by_user_id: user.id,
      is_simulated: true,
      direction: 'inbound',
      sender_name: lead.name.split(' ')[0] ?? lead.name,
      channel: evaluationCampaign.channel,
      delivery_status: 'replied',
      sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  if (eventsError) throw new Error(eventsError.message);

  const token = createToken();
  const { error: tokenError } = await client.from('conversation_simulation_tokens').insert({
    workspace_id: workspace.id,
    thread_id: thread.id,
    token_hash: await hashToken(token),
    created_by: user.id,
  });

  if (tokenError) throw new Error(tokenError.message);

  return token;
}

async function countTable(client: SupabaseClient, table: string, workspaceId: string): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadEvaluationStatus(client: SupabaseClient): Promise<EvaluationStatus> {
  const workspace = await getEvaluationWorkspace(client);
  if (!workspace) {
    return {
      workspace: null,
      leads: 0,
      campaigns: 0,
      threads: 0,
      messages: 0,
      simulationTokens: 0,
      simulatorUrl: null,
    };
  }

  const [leads, campaigns, threads, messages, simulationTokens] = await Promise.all([
    countTable(client, 'leads', workspace.id),
    countTable(client, 'campaigns', workspace.id),
    countTable(client, 'conversation_threads', workspace.id),
    countTable(client, 'conversation_messages', workspace.id),
    countTable(client, 'conversation_simulation_tokens', workspace.id),
  ]);

  return {
    workspace,
    leads,
    campaigns,
    threads,
    messages,
    simulationTokens,
    simulatorUrl: null,
  };
}

export async function seedEvaluationLeads(client: SupabaseClient, user: User): Promise<EvaluationStatus> {
  const workspace = await ensureEvaluationWorkspace(client, user);
  const stageMap = await loadStages(client, workspace.id);
  const fieldMap = await syncEvaluationSchema(client, workspace.id, stageMap);
  await replaceEvaluationLeads(client, workspace.id, user, stageMap, fieldMap);
  return loadEvaluationStatus(client);
}

export async function seedEvaluationCampaign(client: SupabaseClient, user: User): Promise<EvaluationStatus> {
  const workspace = await ensureEvaluationWorkspace(client, user);
  const stageMap = await loadStages(client, workspace.id);
  await upsertEvaluationCampaign(client, workspace.id, user, stageMap);
  return loadEvaluationStatus(client);
}

export async function prepareEvaluationScenario(
  client: SupabaseClient,
  user: User,
  origin: string,
): Promise<EvaluationStatus> {
  const workspace = await ensureEvaluationWorkspace(client, user);
  await resetWorkspaceData(client, workspace.id);
  const stageMap = await loadStages(client, workspace.id);
  const fieldMap = await syncEvaluationSchema(client, workspace.id, stageMap);
  const leads = await replaceEvaluationLeads(client, workspace.id, user, stageMap, fieldMap);
  const campaign = await upsertEvaluationCampaign(client, workspace.id, user, stageMap);
  const simulatorLead = leads.find((lead) => lead.name === 'Alan Menezes') ?? leads[0];
  const token = await seedThreadAndMessages(client, workspace, user, simulatorLead, campaign);
  const status = await loadEvaluationStatus(client);

  return {
    ...status,
    simulatorUrl: `${origin.replace(/\/$/, '')}/client-simulator?token=${token}`,
  };
}

export async function resetEvaluationScenario(client: SupabaseClient): Promise<EvaluationStatus> {
  const workspace = await getEvaluationWorkspace(client);
  if (!workspace) {
    return loadEvaluationStatus(client);
  }

  await resetWorkspaceData(client, workspace.id);
  return loadEvaluationStatus(client);
}
