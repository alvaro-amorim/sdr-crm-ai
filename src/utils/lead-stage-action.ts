export type LeadStageAction =
  | 'keep_current'
  | 'desqualificado'
  | 'qualificado'
  | 'reuniao_agendada'
  | 'tentando_contato'
  | 'conexao_iniciada';

export type LeadStageDecision = {
  action: LeadStageAction;
  scheduled?: boolean;
};

const stageLabels: Record<Exclude<LeadStageAction, 'keep_current'>, string> = {
  desqualificado: 'Desqualificado',
  qualificado: 'Qualificado',
  reuniao_agendada: 'Reunião Agendada',
  tentando_contato: 'Tentando Contato',
  conexao_iniciada: 'Conexão Iniciada',
};

export function getLeadStageActionLabel(action: LeadStageAction): string | null {
  if (action === 'keep_current') return null;
  return stageLabels[action];
}

export function buildLeadStageDecisionNotice(decision: LeadStageDecision | null | undefined): string | null {
  if (!decision) return null;

  if (decision.action === 'keep_current') {
    return 'IA manteve o lead na etapa atual porque a resposta ainda não indicou avanço claro.';
  }

  const stageLabel = getLeadStageActionLabel(decision.action);
  if (!stageLabel) return null;

  if (decision.scheduled) {
    return `IA deixou o avanço para ${stageLabel} preparado. A etapa será atualizada quando a resposta agendada for enviada.`;
  }

  return `IA sinalizou avanço comercial: lead movido para ${stageLabel}.`;
}
