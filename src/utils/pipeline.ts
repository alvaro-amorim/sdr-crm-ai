import type {
  Lead,
  LeadCustomFieldValue,
  PipelineStage,
  StageRequiredField,
  StandardLeadField,
  WorkspaceCustomField,
} from '../types/domain';

export const DEFAULT_PIPELINE_STAGES = [
  'Base',
  'Lead Mapeado',
  'Tentando Contato',
  'Conexão Iniciada',
  'Desqualificado',
  'Qualificado',
  'Reunião Agendada',
] as const;

export const STANDARD_LEAD_FIELDS: Array<{ key: StandardLeadField; label: string }> = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone' },
  { key: 'company', label: 'Empresa' },
  { key: 'job_title', label: 'Cargo' },
  { key: 'lead_source', label: 'Origem' },
  { key: 'notes', label: 'Observações' },
  { key: 'assigned_user_id', label: 'Responsável' },
];

const standardFieldLabels = new Map(STANDARD_LEAD_FIELDS.map((field) => [field.key, field.label]));

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

export function findMissingRequiredFields(params: {
  lead: Lead;
  targetStage: PipelineStage;
  requiredFields: StageRequiredField[];
  customFields: WorkspaceCustomField[];
  customValues: LeadCustomFieldValue[];
}): string[] {
  const stageRules = params.requiredFields.filter((rule) => rule.stage_id === params.targetStage.id);
  const missing: string[] = [];

  for (const rule of stageRules) {
    if (rule.field_key) {
      const value = params.lead[rule.field_key];
      if (!hasValue(value)) {
        missing.push(standardFieldLabels.get(rule.field_key) ?? rule.field_key);
      }
      continue;
    }

    if (rule.custom_field_id) {
      const field = params.customFields.find((item) => item.id === rule.custom_field_id);
      const value = params.customValues.find(
        (item) => item.lead_id === params.lead.id && item.custom_field_id === rule.custom_field_id,
      );

      if (!hasValue(value?.value_text)) {
        missing.push(field?.name ?? 'Campo personalizado');
      }
    }
  }

  return missing;
}

export function createFieldKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}
