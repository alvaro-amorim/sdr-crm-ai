import type { Lead, PipelineStage } from '../types/domain';

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function findStageByName(stages: PipelineStage[], target: string): PipelineStage | undefined {
  const normalizedTarget = normalizeText(target);
  return stages.find((stage) => normalizeText(stage.name) === normalizedTarget);
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function getLeadChannel(lead: Lead): string {
  if (lead.phone) return 'WhatsApp simulado';
  if (lead.email) return 'E-mail simulado';
  return 'Canal comercial simulado';
}

export function getLeadMetaLine(lead: Lead): string {
  return [lead.company, lead.job_title].filter(Boolean).join(' • ') || 'Lead sem empresa ou cargo informado';
}
