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

function nowTag() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function normalizeStageName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function getOrCreateWorkspace(client, fallbackName) {
  const { data: membershipRows, error: membershipError } = await client
    .from('workspace_members')
    .select('id, workspace_id, workspaces(*)')
    .order('created_at', { ascending: true })
    .limit(1);

  if (membershipError) {
    throw new Error(`Falha ao buscar workspace: ${membershipError.message}`);
  }

  const workspaceFromMembership = membershipRows?.[0]?.workspaces;
  const workspace = Array.isArray(workspaceFromMembership)
    ? workspaceFromMembership[0]
    : workspaceFromMembership;

  if (workspace) return workspace;

  const { data, error } = await client.rpc('create_workspace_with_defaults', {
    workspace_name: fallbackName,
  });

  if (error) {
    throw new Error(`Falha ao criar workspace: ${error.message}`);
  }

  if (!data) {
    throw new Error('RPC create_workspace_with_defaults não retornou workspace.');
  }

  return data;
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

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runTag = nowTag();

  console.log('1/6 Autenticando usuário de teste...');
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword,
  });

  if (authError || !authData.session || !authData.user) {
    throw new Error(`Falha no login do usuário de teste: ${authError?.message ?? 'sessão ausente'}`);
  }

  console.log('2/6 Garantindo workspace...');
  const workspace = await getOrCreateWorkspace(client, `Smoke Test ${runTag}`);

  const { data: stages, error: stagesError } = await client
    .from('pipeline_stages')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('position', { ascending: true });

  if (stagesError || !stages?.length) {
    throw new Error(`Falha ao carregar etapas do workspace: ${stagesError?.message ?? 'sem etapas'}`);
  }

  const baseStage = stages[0];
  const contatoStage = stages.find((stage) => normalizeStageName(stage.name) === 'tentando contato');

  if (!contatoStage) {
    throw new Error('Etapa "Tentando Contato" não encontrada no workspace.');
  }

  console.log('3/6 Criando lead de teste...');
  const { data: lead, error: leadError } = await client
    .from('leads')
    .insert({
      workspace_id: workspace.id,
      current_stage_id: baseStage.id,
      assigned_user_id: authData.user.id,
      name: `[SMOKE] Lead ${runTag}`,
      email: `smoke-${runTag}@example.com`,
      company: 'Smoke Test Company',
      job_title: 'SDR',
      lead_source: 'smoke_test',
      notes: 'Lead criado automaticamente pelo smoke test.',
      created_by: authData.user.id,
    })
    .select()
    .single();

  if (leadError || !lead) {
    throw new Error(`Falha ao criar lead: ${leadError?.message ?? 'lead ausente'}`);
  }

  console.log('4/6 Criando campanha de teste...');
  const { data: campaign, error: campaignError } = await client
    .from('campaigns')
    .insert({
      workspace_id: workspace.id,
      name: `[SMOKE] Campanha ${runTag}`,
      context_text: 'Teste automatizado do fluxo de geração de mensagens SDR.',
      generation_prompt:
        'Crie mensagens curtas, profissionais, em português, com CTA objetivo para uma primeira abordagem SDR.',
      trigger_stage_id: null,
      is_active: true,
      created_by: authData.user.id,
    })
    .select()
    .single();

  if (campaignError || !campaign) {
    throw new Error(`Falha ao criar campanha: ${campaignError?.message ?? 'campanha ausente'}`);
  }

  console.log('5/6 Invocando Edge Function generate-lead-messages...');
  const { data: functionData, error: functionError } = await client.functions.invoke('generate-lead-messages', {
    body: {
      workspace_id: workspace.id,
      lead_id: lead.id,
      campaign_id: campaign.id,
    },
  });

  if (functionError) {
    throw new Error(`Falha ao gerar mensagens: ${functionError.message}`);
  }

  const messages = functionData?.data?.messages ?? [];
  if (!Array.isArray(messages) || messages.length < 2) {
    throw new Error('A função não retornou mensagens suficientes para validar o fluxo.');
  }

  console.log(`Mensagens geradas: ${messages.length}. Modelo final: ${functionData?.data?.model ?? 'não informado'}.`);

  const firstMessage = messages[0];
  if (!firstMessage?.id) {
    throw new Error('A primeira mensagem retornada não possui ID.');
  }

  console.log('6/6 Simulando envio e validação de movimentação...');
  const { error: sendEventError } = await client.from('sent_message_events').insert({
    workspace_id: workspace.id,
    lead_id: lead.id,
    campaign_id: campaign.id,
    generated_message_id: firstMessage.id,
    message_text: firstMessage.message_text,
    sent_by_user_id: authData.user.id,
    is_simulated: true,
  });

  if (sendEventError) {
    throw new Error(`Falha ao registrar envio simulado: ${sendEventError.message}`);
  }

  const { error: generatedUpdateError } = await client
    .from('generated_messages')
    .update({ generation_status: 'sent' })
    .eq('workspace_id', workspace.id)
    .eq('id', firstMessage.id);

  if (generatedUpdateError) {
    throw new Error(`Falha ao marcar mensagem como enviada: ${generatedUpdateError.message}`);
  }

  const { error: leadMoveError } = await client
    .from('leads')
    .update({ current_stage_id: contatoStage.id, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspace.id)
    .eq('id', lead.id);

  if (leadMoveError) {
    throw new Error(`Falha ao mover lead para Tentando Contato: ${leadMoveError.message}`);
  }

  const { data: updatedLead, error: updatedLeadError } = await client
    .from('leads')
    .select('id, current_stage_id')
    .eq('workspace_id', workspace.id)
    .eq('id', lead.id)
    .single();

  if (updatedLeadError || !updatedLead) {
    throw new Error(`Falha ao validar lead atualizado: ${updatedLeadError?.message ?? 'lead ausente'}`);
  }

  if (updatedLead.current_stage_id !== contatoStage.id) {
    throw new Error('O lead não foi movido para a etapa Tentando Contato.');
  }

  console.log('Smoke test concluído com sucesso.');
  console.log(
    JSON.stringify(
      {
        workspace_id: workspace.id,
        lead_id: lead.id,
        campaign_id: campaign.id,
        generated_messages: messages.length,
        first_message_id: firstMessage.id,
        final_stage: contatoStage.name,
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
