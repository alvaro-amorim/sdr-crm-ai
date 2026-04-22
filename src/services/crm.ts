import type { SupabaseClient, User } from '@supabase/supabase-js';
import type {
  Campaign,
  ConversationMessage,
  ConversationThread,
  CrmData,
  GeneratedMessage,
  Lead,
  LeadCustomFieldValue,
  PipelineStage,
  SentMessageEvent,
  StageRequiredField,
  Workspace,
  WorkspaceCustomField,
  WorkspaceMember,
} from '../types/domain';

export type LeadInput = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
  lead_source: string;
  notes: string;
  assigned_user_id: string | null;
  current_stage_id: string;
  customValues: Record<string, string>;
};

export type CampaignInput = {
  id?: string;
  name: string;
  context_text: string;
  generation_prompt: string;
  trigger_stage_id: string | null;
  is_active: boolean;
};

function assertData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Operação sem retorno do banco.');
  return data;
}

export async function createWorkspaceWithDefaults(client: SupabaseClient, user: User, name: string): Promise<Workspace> {
  if (!user.id) throw new Error('Sessão inválida.');

  const { data, error } = await client.rpc('create_workspace_with_defaults', {
    workspace_name: name,
  });

  return assertData(data as Workspace | null, error);
}

export async function getFirstWorkspace(client: SupabaseClient): Promise<Workspace | null> {
  const { data, error } = await client
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, created_at, workspaces(*)')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) throw new Error(error.message);
  const member = (data?.[0] ?? null) as unknown as WorkspaceMember | null;
  const workspace = member?.workspaces;
  return Array.isArray(workspace) ? (workspace[0] ?? null) : (workspace ?? null);
}

export async function loadCrmData(client: SupabaseClient, workspace: Workspace): Promise<CrmData> {
  const [
    stagesResult,
    requiredFieldsResult,
    customFieldsResult,
    leadsResult,
    customValuesResult,
    campaignsResult,
    generatedMessagesResult,
    sentMessageEventsResult,
    conversationThreadsResult,
    conversationMessagesResult,
  ] = await Promise.all([
    client.from('pipeline_stages').select('*').eq('workspace_id', workspace.id).order('position', { ascending: true }),
    client.from('stage_required_fields').select('*').eq('workspace_id', workspace.id),
    client.from('workspace_custom_fields').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: true }),
    client.from('leads').select('*').eq('workspace_id', workspace.id).order('updated_at', { ascending: false }),
    client.from('lead_custom_field_values').select('*').eq('workspace_id', workspace.id),
    client.from('campaigns').select('*').eq('workspace_id', workspace.id).order('updated_at', { ascending: false }),
    client.from('generated_messages').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
    client.from('sent_message_events').select('*').eq('workspace_id', workspace.id).order('sent_at', { ascending: false }),
    client.from('conversation_threads').select('*').eq('workspace_id', workspace.id).order('updated_at', { ascending: false }),
    client.from('conversation_messages').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: true }),
  ]);

  for (const result of [
    stagesResult,
    requiredFieldsResult,
    customFieldsResult,
    leadsResult,
    customValuesResult,
    campaignsResult,
    generatedMessagesResult,
    sentMessageEventsResult,
    conversationThreadsResult,
    conversationMessagesResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  return {
    workspace,
    stages: (stagesResult.data ?? []) as PipelineStage[],
    requiredFields: (requiredFieldsResult.data ?? []) as StageRequiredField[],
    customFields: (customFieldsResult.data ?? []) as WorkspaceCustomField[],
    leads: (leadsResult.data ?? []) as Lead[],
    customValues: (customValuesResult.data ?? []) as LeadCustomFieldValue[],
    campaigns: (campaignsResult.data ?? []) as Campaign[],
    generatedMessages: (generatedMessagesResult.data ?? []) as GeneratedMessage[],
    sentMessageEvents: (sentMessageEventsResult.data ?? []) as SentMessageEvent[],
    conversationThreads: (conversationThreadsResult.data ?? []) as ConversationThread[],
    conversationMessages: (conversationMessagesResult.data ?? []) as ConversationMessage[],
  };
}

export async function upsertLead(
  client: SupabaseClient,
  workspace: Workspace,
  user: User,
  input: LeadInput,
): Promise<Lead> {
  const payload = {
    workspace_id: workspace.id,
    current_stage_id: input.current_stage_id,
    assigned_user_id: input.assigned_user_id || null,
    name: input.name.trim(),
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    company: input.company.trim() || null,
    job_title: input.job_title.trim() || null,
    lead_source: input.lead_source.trim() || null,
    notes: input.notes.trim() || null,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? client.from('leads').update(payload).eq('id', input.id).eq('workspace_id', workspace.id).select().single()
    : client.from('leads').insert(payload).select().single();

  const { data, error } = await query;
  const lead = assertData(data as Lead | null, error);

  const values = Object.entries(input.customValues)
    .filter(([, value]) => value.trim().length > 0)
    .map(([custom_field_id, value_text]) => ({
      workspace_id: workspace.id,
      lead_id: lead.id,
      custom_field_id,
      value_text: value_text.trim(),
      updated_at: new Date().toISOString(),
    }));

  if (input.id) {
    const { error: deleteError } = await client
      .from('lead_custom_field_values')
      .delete()
      .eq('workspace_id', workspace.id)
      .eq('lead_id', lead.id);
    if (deleteError) throw new Error(deleteError.message);
  }

  if (values.length > 0) {
    const { error: valuesError } = await client.from('lead_custom_field_values').upsert(values, {
      onConflict: 'lead_id,custom_field_id',
    });
    if (valuesError) throw new Error(valuesError.message);
  }

  return lead;
}

export async function saveRequiredFields(
  client: SupabaseClient,
  workspaceId: string,
  stageId: string,
  standardFieldKeys: string[],
  customFieldIds: string[],
): Promise<void> {
  const { error: deleteError } = await client
    .from('stage_required_fields')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('stage_id', stageId);
  if (deleteError) throw new Error(deleteError.message);

  const rows = [
    ...standardFieldKeys.map((field_key) => ({
      workspace_id: workspaceId,
      stage_id: stageId,
      field_key,
      custom_field_id: null,
    })),
    ...customFieldIds.map((custom_field_id) => ({
      workspace_id: workspaceId,
      stage_id: stageId,
      field_key: null,
      custom_field_id,
    })),
  ];

  if (rows.length > 0) {
    const { error } = await client.from('stage_required_fields').insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function upsertCampaign(
  client: SupabaseClient,
  workspace: Workspace,
  user: User,
  input: CampaignInput,
): Promise<Campaign> {
  const payload = {
    workspace_id: workspace.id,
    name: input.name.trim(),
    context_text: input.context_text.trim(),
    generation_prompt: input.generation_prompt.trim(),
    trigger_stage_id: input.trigger_stage_id || null,
    is_active: input.is_active,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? client.from('campaigns').update(payload).eq('workspace_id', workspace.id).eq('id', input.id).select().single()
    : client.from('campaigns').insert(payload).select().single();

  const { data, error } = await query;
  return assertData(data as Campaign | null, error);
}

export async function moveLead(client: SupabaseClient, workspaceId: string, leadId: string, stageId: string): Promise<void> {
  const { error } = await client
    .from('leads')
    .update({ current_stage_id: stageId, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', leadId);
  if (error) throw new Error(error.message);
}
