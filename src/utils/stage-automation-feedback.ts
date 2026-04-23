import type { StageTriggerAutomationResult } from '../services/crm';
import { getErrorMessage } from './error-messages';

export type StageAutomationFeedback = {
  notice: string;
  warning: string | null;
};

function trimSentence(text: string): string {
  return text.trim().replace(/[.\s]+$/g, '');
}

function withPeriod(text: string): string {
  return `${trimSentence(text)}.`;
}

export function buildStageAutomationFeedback(params: {
  successMessage: string;
  failurePrefix: string;
  automation: StageTriggerAutomationResult;
}): StageAutomationFeedback {
  const noticeParts = [withPeriod(params.successMessage)];

  if (params.automation.generatedCampaignNames.length === 1) {
    noticeParts.push(`Mensagens geradas automaticamente para ${params.automation.generatedCampaignNames[0]}.`);
  } else if (params.automation.generatedCampaignNames.length > 1) {
    noticeParts.push(`${params.automation.generatedCampaignNames.length} campanhas geraram mensagens automaticamente.`);
  }

  const warning =
    params.automation.failedCampaigns.length > 0
      ? `${trimSentence(params.failurePrefix)}: ${params.automation.failedCampaigns.map((item) => item.name).join(', ')}.`
      : null;

  return {
    notice: noticeParts.join(' '),
    warning,
  };
}

export function buildStageAutomationErrorWarning(failurePrefix: string, error: unknown): string {
  const detailMessage = getErrorMessage(error, 'automation');
  const detail = detailMessage ? withPeriod(detailMessage) : null;

  if (!detail) {
    return withPeriod(failurePrefix);
  }

  return `${withPeriod(failurePrefix)} ${detail}`;
}
