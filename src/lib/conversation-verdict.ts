export type ConversationSentiment = 'positive' | 'neutral' | 'negative' | 'mixed';
export type ConversationThreadStatus = 'open' | 'positive' | 'neutral' | 'negative' | 'meeting_scheduled' | 'closed';
export type LeadStageAction =
  | 'keep_current'
  | 'desqualificado'
  | 'qualificado'
  | 'reuniao_agendada'
  | 'tentando_contato'
  | 'conexao_iniciada';

export type AiConversationVerdict = {
  message_text: string;
  sentiment_tag: ConversationSentiment;
  intent_tag: string;
  thread_status: ConversationThreadStatus;
  lead_stage_action: LeadStageAction;
  should_close: boolean;
};

const NEGATIVE_PATTERNS = [
  'nao e prioridade',
  'sem prioridade',
  'nao temos interesse',
  'sem interesse',
  'nao conseguimos abrir espaco',
  'nao conseguimos seguir',
  'nao faz sentido',
  'nao vamos seguir',
  'focados em outras demandas',
  'nao agora',
  'talvez no futuro',
  'agradeco a compreensao',
  'agradeco o contato, mas',
  'ja temos uma solucao',
];

const MEETING_PATTERNS = [
  'podemos marcar uma reuniao',
  'podemos agendar uma reuniao',
  'vamos agendar',
  'pode me mandar um horario',
  'me manda um horario',
  'podemos falar',
  'vamos falar',
  'podemos conversar amanha',
  'agendar uma call',
  'marcar uma call',
];

export function normalizeConversationText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAnyPattern(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

export function getDeterministicConversationOutcome(clientMessage: string): Partial<AiConversationVerdict> {
  const normalized = normalizeConversationText(clientMessage);
  if (!normalized) return {};

  if (includesAnyPattern(normalized, NEGATIVE_PATTERNS)) {
    return {
      sentiment_tag: 'negative',
      thread_status: 'negative',
      lead_stage_action: 'desqualificado',
      should_close: true,
      intent_tag: 'closing_note',
    };
  }

  if (includesAnyPattern(normalized, MEETING_PATTERNS)) {
    return {
      sentiment_tag: 'positive',
      thread_status: 'meeting_scheduled',
      lead_stage_action: 'reuniao_agendada',
      should_close: false,
      intent_tag: 'meeting_confirmation',
    };
  }

  return {};
}

export function sanitizeConversationVerdict(input: Partial<AiConversationVerdict> & { message_text: string }): AiConversationVerdict {
  const sentiment = input.sentiment_tag;
  const threadStatus = input.thread_status;
  const stageAction = input.lead_stage_action;

  return {
    message_text: input.message_text.trim().slice(0, 2200),
    sentiment_tag: sentiment === 'positive' || sentiment === 'negative' || sentiment === 'mixed' ? sentiment : 'neutral',
    intent_tag: (input.intent_tag?.trim() || 'follow_up').slice(0, 80),
    thread_status:
      threadStatus === 'positive' ||
      threadStatus === 'negative' ||
      threadStatus === 'meeting_scheduled' ||
      threadStatus === 'closed' ||
      threadStatus === 'open'
        ? threadStatus
        : 'neutral',
    lead_stage_action:
      stageAction === 'desqualificado' ||
      stageAction === 'qualificado' ||
      stageAction === 'reuniao_agendada' ||
      stageAction === 'tentando_contato' ||
      stageAction === 'conexao_iniciada'
        ? stageAction
        : 'keep_current',
    should_close: Boolean(input.should_close),
  };
}

export function mergeConversationVerdict<T extends Partial<AiConversationVerdict> & { message_text: string }>(
  clientMessage: string,
  aiVerdict: T,
): AiConversationVerdict & Omit<T, keyof AiConversationVerdict> {
  const sanitized = sanitizeConversationVerdict(aiVerdict);
  const deterministic = getDeterministicConversationOutcome(clientMessage);

  return {
    ...aiVerdict,
    ...sanitized,
    ...deterministic,
    message_text: sanitized.message_text,
  } as AiConversationVerdict & Omit<T, keyof AiConversationVerdict>;
}
