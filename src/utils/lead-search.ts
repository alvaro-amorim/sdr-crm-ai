import type { Lead } from '../types/domain';
import { normalizeText } from './crm-ui';

export type LeadSearchOption = {
  lead: Lead;
  label: string;
  subtitle: string;
  contact: string;
  matchLabel: string;
};

function getLeadSearchFields(lead: Lead) {
  return {
    name: lead.name,
    company: lead.company ?? '',
    jobTitle: lead.job_title ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    source: lead.lead_source ?? '',
  };
}

function scoreField(value: string, query: string, baseScore: number) {
  const normalized = normalizeText(value);
  if (!normalized || !query) return null;
  if (normalized === query) return baseScore;
  if (normalized.startsWith(query)) return baseScore + 5;
  if (normalized.split(/\s+/).some((part) => part.startsWith(query))) return baseScore + 12;
  if (normalized.includes(query)) return baseScore + 28;
  return null;
}

function getBestLeadScore(lead: Lead, query: string) {
  const fields = getLeadSearchFields(lead);
  const candidates = [
    { score: scoreField(fields.name, query, 0), label: 'nome do lead' },
    { score: scoreField(fields.company, query, 40), label: 'empresa' },
    { score: scoreField(fields.jobTitle, query, 80), label: 'cargo' },
    { score: scoreField(fields.email, query, 95), label: 'e-mail' },
    { score: scoreField(fields.phone, query, 100), label: 'telefone' },
    { score: scoreField(fields.source, query, 110), label: 'origem' },
  ].filter((item): item is { score: number; label: string } => item.score !== null);

  return candidates.sort((left, right) => left.score - right.score)[0] ?? null;
}

export function toLeadSearchOption(lead: Lead, matchLabel = 'lead') {
  const company = lead.company?.trim() || 'Empresa não informada';
  const jobTitle = lead.job_title?.trim();

  return {
    lead,
    label: lead.name,
    subtitle: jobTitle ? `${company} · ${jobTitle}` : company,
    contact: lead.email ?? lead.phone ?? 'Contato não informado',
    matchLabel,
  };
}

export function rankLeadOptions(query: string, leads: Lead[]): LeadSearchOption[] {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return [...leads]
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
      .map((lead) => toLeadSearchOption(lead, 'lista completa'));
  }

  return leads
    .map((lead) => {
      const match = getBestLeadScore(lead, normalizedQuery);
      return match ? { lead, match } : null;
    })
    .filter((item): item is { lead: Lead; match: { score: number; label: string } } => item !== null)
    .sort((left, right) => {
      const scoreDiff = left.match.score - right.match.score;
      if (scoreDiff !== 0) return scoreDiff;
      return left.lead.name.localeCompare(right.lead.name, 'pt-BR');
    })
    .map(({ lead, match }) => toLeadSearchOption(lead, match.label));
}
