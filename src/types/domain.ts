export type StandardLeadField =
  | 'name'
  | 'email'
  | 'phone'
  | 'company'
  | 'job_title'
  | 'lead_source'
  | 'notes'
  | 'assigned_user_id';

export type Workspace = {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'member';
  created_at: string;
  workspaces?: Workspace;
};

export type PipelineStage = {
  id: string;
  workspace_id: string;
  name: string;
  position: number;
  is_default: boolean;
  created_at: string;
};

export type WorkspaceCustomField = {
  id: string;
  workspace_id: string;
  name: string;
  field_key: string;
  field_type: 'text' | 'number';
  created_at: string;
};

export type StageRequiredField = {
  id: string;
  workspace_id: string;
  stage_id: string;
  field_key: StandardLeadField | null;
  custom_field_id: string | null;
  created_at: string;
};

export type Lead = {
  id: string;
  workspace_id: string;
  current_stage_id: string;
  assigned_user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  lead_source: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type LeadCustomFieldValue = {
  id: string;
  workspace_id: string;
  lead_id: string;
  custom_field_id: string;
  value_text: string | null;
  created_at: string;
  updated_at: string;
};

export type Campaign = {
  id: string;
  workspace_id: string;
  name: string;
  context_text: string;
  generation_prompt: string;
  trigger_stage_id: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type GeneratedMessage = {
  id: string;
  workspace_id: string;
  lead_id: string;
  campaign_id: string;
  variation_index: number;
  message_text: string;
  generation_status: 'generated' | 'sent' | 'failed';
  generated_by_user_id: string | null;
  created_at: string;
};

export type SentMessageEvent = {
  id: string;
  workspace_id: string;
  lead_id: string;
  campaign_id: string;
  generated_message_id: string | null;
  message_text: string;
  sent_by_user_id: string;
  is_simulated: boolean;
  sent_at: string;
};

export type CrmData = {
  workspace: Workspace;
  stages: PipelineStage[];
  requiredFields: StageRequiredField[];
  customFields: WorkspaceCustomField[];
  leads: Lead[];
  customValues: LeadCustomFieldValue[];
  campaigns: Campaign[];
  generatedMessages: GeneratedMessage[];
};
