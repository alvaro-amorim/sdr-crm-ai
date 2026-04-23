import { describe, expect, it } from 'vitest';
import { createFieldKey, findMissingRequiredFields } from './pipeline';
import type { Lead, PipelineStage, StageRequiredField, WorkspaceCustomField } from '../types/domain';

const stage: PipelineStage = {
  id: 'stage-1',
  workspace_id: 'workspace-1',
  name: 'Qualificado',
  position: 5,
  is_default: true,
  created_at: new Date().toISOString(),
};

const lead: Lead = {
  id: 'lead-1',
  workspace_id: 'workspace-1',
  current_stage_id: 'stage-0',
  assigned_user_id: null,
  technical_owner_name: null,
  name: 'Lead Exemplo',
  email: null,
  phone: '11999999999',
  company: '',
  job_title: null,
  lead_source: null,
  notes: null,
  created_by: 'user-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('pipeline rules', () => {
  it('bloqueia campo padrão obrigatório ausente', () => {
    const requiredFields: StageRequiredField[] = [
      {
        id: 'rule-1',
        workspace_id: 'workspace-1',
        stage_id: stage.id,
        field_key: 'email',
        custom_field_id: null,
        created_at: new Date().toISOString(),
      },
    ];

    expect(
      findMissingRequiredFields({
        lead,
        targetStage: stage,
        requiredFields,
        customFields: [],
        customValues: [],
      }),
    ).toEqual(['E-mail']);
  });

  it('bloqueia campo personalizado obrigatório ausente', () => {
    const customFields: WorkspaceCustomField[] = [
      {
        id: 'field-1',
        workspace_id: 'workspace-1',
        name: 'Tamanho da equipe',
        field_key: 'tamanho_da_equipe',
        field_type: 'number',
        created_at: new Date().toISOString(),
      },
    ];
    const requiredFields: StageRequiredField[] = [
      {
        id: 'rule-1',
        workspace_id: 'workspace-1',
        stage_id: stage.id,
        field_key: null,
        custom_field_id: 'field-1',
        created_at: new Date().toISOString(),
      },
    ];

    expect(
      findMissingRequiredFields({
        lead,
        targetStage: stage,
        requiredFields,
        customFields,
        customValues: [],
      }),
    ).toEqual(['Tamanho da equipe']);
  });

  it('permite transicao quando todos os campos existem', () => {
    expect(
      findMissingRequiredFields({
        lead: { ...lead, email: 'lead@example.com' },
        targetStage: stage,
        requiredFields: [
          {
            id: 'rule-1',
            workspace_id: 'workspace-1',
            stage_id: stage.id,
            field_key: 'email',
            custom_field_id: null,
            created_at: new Date().toISOString(),
          },
        ],
        customFields: [],
        customValues: [],
      }),
    ).toEqual([]);
  });

  it('gera field_key estável e seguro', () => {
    expect(createFieldKey('Tamanho da Equipe!')).toBe('tamanho_da_equipe');
  });
});
