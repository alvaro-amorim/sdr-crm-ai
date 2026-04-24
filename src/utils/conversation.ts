import type { ConversationMessage } from '../types/domain';

const directionTieBreaker: Record<ConversationMessage['direction'], number> = {
  inbound: 0,
  outbound: 1,
};

export function compareConversationMessagesAsc(left: ConversationMessage, right: ConversationMessage) {
  const leftTime = new Date(left.created_at).getTime();
  const rightTime = new Date(right.created_at).getTime();
  const safeLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
  const safeRightTime = Number.isNaN(rightTime) ? 0 : rightTime;

  if (safeLeftTime !== safeRightTime) return safeLeftTime - safeRightTime;

  const directionDiff = directionTieBreaker[left.direction] - directionTieBreaker[right.direction];
  if (directionDiff !== 0) return directionDiff;

  return left.id.localeCompare(right.id, 'pt-BR');
}

export function sortConversationMessages(messages: ConversationMessage[]) {
  return [...messages].sort(compareConversationMessagesAsc);
}
