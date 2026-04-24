import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  EVALUATION_CUSTOM_FIELDS,
  EVALUATION_STAGE_REQUIRED_RULES,
  getSmokeCampaignTemplate,
  getSmokeLeadProfiles,
  isoHoursAgo,
  normalizeStageName,
  safeSlug,
} from './evaluation-fixtures.mjs';

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const entries = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    entries[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
  }

  return entries;
}

function requireEnv(env, key) {
  const value = env[key];
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${key}`);
  return value;
}

function stageIdByName(stageMap, name) {
  const stage = stageMap.get(normalizeStageName(name));
  if (!stage) throw new Error(`Etapa nao encontrada: ${name}`);
  return stage.id;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createToken() {
  return randomBytes(32).toString('base64url');
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
  if (!data) throw new Error('RPC create_workspace_with_defaults nao retornou workspace.');
  return data;
}

async function resetWorkspaceData(client, workspaceId) {
  const deletePlans = [
    ['conversation_simulation_tokens', 'tokens do simulador'],
    ['conversation_messages', 'mensagens de conversa'],
    ['conversation_threads', 'threads de conversa'],
    ['sent_message_events', 'eventos simulados'],
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
  const rows = EVALUATION_CUSTOM_FIELDS.map((field) => ({ workspace_id: workspaceId, ...field }));
  const { data, error } = await client.from('workspace_custom_fields').insert(rows).select();
  if (error || !data) throw new Error(`Falha ao criar campos personalizados: ${error?.message ?? 'sem retorno'}`);
  return new Map(data.map((field) => [field.field_key, field]));
}

async function saveStageRequiredFields(client, workspaceId, stageMap, customFieldMap) {
  const rows = EVALUATION_STAGE_REQUIRED_RULES
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

async function createSmokeCampaign(client, workspaceId, userId, stageMap) {
  const campaign = getSmokeCampaignTemplate();
  const { data, error } = await client
    .from('campaigns')
    .insert({
      workspace_id: workspaceId,
      name: campaign.name,
      context_text: campaign.context_text,
      generation_prompt: campaign.generation_prompt,
      trigger_stage_id: stageIdByName(stageMap, campaign.triggerStage),
      is_active: true,
      created_by: userId,
      created_at: isoHoursAgo(8),
      updated_at: isoHoursAgo(7),
    })
    .select()
    .single();

  if (error || !data) throw new Error(`Falha ao criar campanha de exemplo: ${error?.message ?? 'sem retorno'}`);
  return { ...data, channel: campaign.channel, slug: campaign.slug, goal: campaign.goal };
}

async function createSmokeLeads(client, workspaceId, userId, stageMap) {
  const profiles = getSmokeLeadProfiles();
  const rows = profiles.map((lead, index) => ({
    workspace_id: workspaceId,
    current_stage_id: stageIdByName(stageMap, lead.stageName),
    assigned_user_id: userId,
    technical_owner_name: lead.technical_owner_name,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    job_title: lead.job_title,
    lead_source: lead.lead_source,
    notes: lead.notes,
    created_by: userId,
    created_at: isoHoursAgo(12 - index),
    updated_at: isoHoursAgo(12 - index),
  }));

  const { data, error } = await client.from('leads').insert(rows).select();
  if (error || !data) throw new Error(`Falha ao criar leads de exemplo: ${error?.message ?? 'sem retorno'}`);

  const leadMap = new Map();
  for (const profile of profiles) {
    const record = data.find((lead) => lead.name === profile.name && lead.company === profile.company);
    if (!record) throw new Error(`Lead nao encontrado apos insert: ${profile.name}`);
    leadMap.set(profile.slug, { record, profile });
  }

  return { leadMap, profiles };
}

async function saveLeadCustomValues(client, workspaceId, leadMap, customFieldMap) {
  const rows = [];
  for (const { record, profile } of leadMap.values()) {
    for (const field of EVALUATION_CUSTOM_FIELDS) {
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

async function seedThreadAndMessages(client, workspace, userId, leadRecord, campaign) {
  const threadCreatedAt = isoHoursAgo(4);
  const { data: thread, error: threadError } = await client
    .from('conversation_threads')
    .insert({
      workspace_id: workspace.id,
      lead_id: leadRecord.id,
      campaign_id: campaign.id,
      title: `${leadRecord.name} · ${campaign.name}`,
      channel: campaign.channel,
      status: 'positive',
      sentiment_tag: 'positive',
      simulation_enabled: true,
      created_by: userId,
      created_at: threadCreatedAt,
      updated_at: isoHoursAgo(3),
    })
    .select()
    .single();

  if (threadError || !thread) throw new Error(`Falha ao criar thread seed: ${threadError?.message ?? 'sem retorno'}`);

  const generatedRows = [
    {
      workspace_id: workspace.id,
      lead_id: leadRecord.id,
      campaign_id: campaign.id,
      variation_index: 1,
      message_text: 'Oi, Bianca. Vi que sua equipe esta revisando o processo comercial. Posso te mostrar em 10 minutos como centralizar cadencia, respostas e proximo passo do lead sem depender de planilha?',
      generation_status: 'sent',
      generated_by_user_id: userId,
      created_at: isoHoursAgo(4),
    },
    {
      workspace_id: workspace.id,
      lead_id: leadRecord.id,
      campaign_id: campaign.id,
      variation_index: 2,
      message_text: 'Se fizer sentido, eu preparo um diagnostico curto com gargalos, responsaveis e proximo movimento por etapa.',
      generation_status: 'generated',
      generated_by_user_id: userId,
      created_at: isoHoursAgo(2),
    },
  ];

  const { data: generatedMessages, error: generatedError } = await client.from('generated_messages').insert(generatedRows).select();
  if (generatedError || !generatedMessages?.length) {
    throw new Error(`Falha ao criar mensagens seed: ${generatedError?.message ?? 'sem retorno'}`);
  }

  const outboundMessage = generatedMessages.find((message) => message.variation_index === 1);
  if (!outboundMessage) throw new Error('Mensagem outbound seed nao encontrada.');

  const conversationRows = [
    {
      workspace_id: workspace.id,
      thread_id: thread.id,
      lead_id: leadRecord.id,
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
      created_at: isoHoursAgo(4),
    },
    {
      workspace_id: workspace.id,
      thread_id: thread.id,
      lead_id: leadRecord.id,
      campaign_id: campaign.id,
      direction: 'inbound',
      sender_type: 'client',
      sender_name: leadRecord.name.split(' ')[0],
      message_text: 'Oi. Temos interesse em revisar isso, mas quero entender como o sistema ajuda a priorizar os leads e registrar a conversa.',
      sentiment_tag: 'positive',
      intent_tag: 'interested_needs_context',
      generated_by: 'seed',
      created_at: isoHoursAgo(3),
    },
  ];

  const { error: conversationError } = await client.from('conversation_messages').insert(conversationRows);
  if (conversationError) throw new Error(`Falha ao salvar conversa seed: ${conversationError.message}`);

  const eventRows = [
    {
      workspace_id: workspace.id,
      lead_id: leadRecord.id,
      campaign_id: campaign.id,
      generated_message_id: outboundMessage.id,
      message_text: outboundMessage.message_text,
      sent_by_user_id: userId,
      is_simulated: true,
      direction: 'outbound',
      sender_name: 'SDR Expert',
      channel: campaign.channel,
      delivery_status: 'read',
      sent_at: isoHoursAgo(4),
    },
    {
      workspace_id: workspace.id,
      lead_id: leadRecord.id,
      campaign_id: campaign.id,
      generated_message_id: null,
      message_text: 'Oi. Temos interesse em revisar isso, mas quero entender como o sistema ajuda a priorizar os leads e registrar a conversa.',
      sent_by_user_id: userId,
      is_simulated: true,
      direction: 'inbound',
      sender_name: leadRecord.name.split(' ')[0],
      channel: campaign.channel,
      delivery_status: 'replied',
      sent_at: isoHoursAgo(3),
    },
  ];

  const { error: eventError } = await client.from('sent_message_events').insert(eventRows);
  if (eventError) throw new Error(`Falha ao salvar eventos seed: ${eventError.message}`);

  const token = createToken();
  const { error: tokenError } = await client.from('conversation_simulation_tokens').insert({
    workspace_id: workspace.id,
    thread_id: thread.id,
    token_hash: hashToken(token),
    created_by: userId,
  });
  if (tokenError) throw new Error(`Falha ao criar token do simulador: ${tokenError.message}`);

  return token;
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
  const testUserEmail = requireEnv(env, 'TEST_USER_EMAIL');
  const testUserPassword = requireEnv(env, 'TEST_USER_PASSWORD');
  const workspaceName = env.SMOKE_WORKSPACE_NAME?.trim() || 'Operacao SDR Smoke';
  const publicBaseUrl = env.SMOKE_PUBLIC_BASE_URL?.trim() || 'https://sdr-crm-ai-wine.vercel.app';

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('1/8 Autenticando usuario de teste...');
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword,
  });
  if (authError || !authData.session || !authData.user) {
    throw new Error(`Falha no login do usuario de teste: ${authError?.message ?? 'sessao ausente'}`);
  }

  console.log(`2/8 Garantindo workspace do smoke "${workspaceName}"...`);
  const workspace = await getOrCreateWorkspace(client, workspaceName);

  console.log('3/8 Limpando dados anteriores do workspace do smoke...');
  await resetWorkspaceData(client, workspace.id);

  console.log('4/8 Carregando etapas e configurando campos basicos...');
  const stages = await loadStages(client, workspace.id);
  const stageMap = new Map(stages.map((stage) => [normalizeStageName(stage.name), stage]));
  const customFieldMap = await createCustomFields(client, workspace.id);
  await saveStageRequiredFields(client, workspace.id, stageMap, customFieldMap);

  console.log('5/8 Criando campanha e leads deterministas...');
  const campaign = await createSmokeCampaign(client, workspace.id, authData.user.id, stageMap);
  const { leadMap } = await createSmokeLeads(client, workspace.id, authData.user.id, stageMap);
  await saveLeadCustomValues(client, workspace.id, leadMap, customFieldMap);

  console.log('6/8 Semeando uma conversa curta e um token de simulador...');
  const targetLead = leadMap.get(safeSlug('Bianca Nogueira-Clara Saude'));
  if (!targetLead) throw new Error('Lead seed principal nao encontrado.');
  const token = await seedThreadAndMessages(client, workspace, authData.user.id, targetLead.record, campaign);

  console.log('7/8 Validando contagens minimas...');
  const [leadCount, campaignCount, threadCount, conversationMessageCount, tokenCount] = await Promise.all([
    countTable(client, 'leads', workspace.id),
    countTable(client, 'campaigns', workspace.id),
    countTable(client, 'conversation_threads', workspace.id),
    countTable(client, 'conversation_messages', workspace.id),
    countTable(client, 'conversation_simulation_tokens', workspace.id),
  ]);

  if (leadCount !== 3) throw new Error(`Smoke criou ${leadCount} leads; o esperado era 3.`);
  if (campaignCount !== 1) throw new Error(`Smoke criou ${campaignCount} campanhas; o esperado era 1.`);
  if (threadCount !== 1) throw new Error(`Smoke criou ${threadCount} threads; o esperado era 1.`);
  if (conversationMessageCount < 2) throw new Error('Smoke nao deixou conversa seeded suficiente para demonstracao.');
  if (tokenCount !== 1) throw new Error('Smoke nao criou token do simulador.');

  console.log('8/8 Smoke leve concluido com sucesso.');
  console.log(
    JSON.stringify(
      {
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        leads: leadCount,
        campaigns: campaignCount,
        threads: threadCount,
        conversation_messages: conversationMessageCount,
        simulation_tokens: tokenCount,
        simulator_url: `${publicBaseUrl.replace(/\/$/, '')}/client-simulator?token=${token}`,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
