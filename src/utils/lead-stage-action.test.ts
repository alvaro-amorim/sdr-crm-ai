import { describe, expect, it } from 'vitest';
import { buildLeadStageDecisionNotice } from './lead-stage-action';

describe('lead stage action feedback', () => {
  it('explica quando a IA mantem a etapa atual', () => {
    expect(buildLeadStageDecisionNotice({ action: 'keep_current' })).toBe(
      'IA manteve o lead na etapa atual porque a resposta ainda não indicou avanço claro.',
    );
  });

  it('explica avanco automatico aplicado imediatamente', () => {
    expect(buildLeadStageDecisionNotice({ action: 'qualificado' })).toBe(
      'IA sinalizou avanço comercial: lead movido para Qualificado.',
    );
  });

  it('explica avanco preparado para resposta agendada', () => {
    expect(buildLeadStageDecisionNotice({ action: 'reuniao_agendada', scheduled: true })).toBe(
      'IA deixou o avanço para Reunião Agendada preparado. A etapa será atualizada quando a resposta agendada for enviada.',
    );
  });
});
