import { describe, expect, it } from 'vitest';
import type { Lead } from '../types/domain';
import { rankLeadOptions } from './lead-search';

const baseLead: Lead = {
  id: 'lead-base',
  workspace_id: 'workspace-1',
  current_stage_id: 'stage-1',
  assigned_user_id: null,
  technical_owner_name: null,
  name: 'Lead Base',
  email: null,
  phone: null,
  company: null,
  job_title: null,
  lead_source: null,
  notes: null,
  created_by: 'user-1',
  created_at: '2026-04-20T10:00:00.000Z',
  updated_at: '2026-04-20T10:00:00.000Z',
};

function makeLead(input: Partial<Lead> & Pick<Lead, 'id' | 'name'>): Lead {
  return {
    ...baseLead,
    ...input,
  };
}

describe('lead search ranking', () => {
  it('prioriza nome do lead antes de empresa que contem a busca', () => {
    const ranked = rankLeadOptions('b', [
      makeLead({ id: 'a-company', name: 'Aline Teixeira', company: 'ViaBordo' }),
      makeLead({ id: 'b-name', name: 'Bruno Costa', company: 'Acme' }),
    ]);

    expect(ranked.map((option) => option.lead.id)).toEqual(['b-name', 'a-company']);
  });

  it('prioriza empresa iniciando com a busca antes de campo secundario', () => {
    const ranked = rankLeadOptions('br', [
      makeLead({ id: 'secondary', name: 'Carlos Lima', company: 'Acme', job_title: 'Brand manager' }),
      makeLead({ id: 'company', name: 'Daniel Rocha', company: 'Brava Tech' }),
    ]);

    expect(ranked.map((option) => option.lead.id)).toEqual(['company', 'secondary']);
  });

  it('query vazia lista todos os leads sem impor selecao automatica', () => {
    const ranked = rankLeadOptions('', [
      makeLead({ id: 'z', name: 'Zuleica Prado' }),
      makeLead({ id: 'a', name: 'Aline Teixeira' }),
    ]);

    expect(ranked.map((option) => option.lead.id)).toEqual(['a', 'z']);
  });
});
