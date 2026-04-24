import { describe, expect, it } from 'vitest';
import type { ConversationMessage } from '../types/domain';
import { sortConversationMessages } from './conversation';

const baseMessage: ConversationMessage = {
  id: 'message-base',
  workspace_id: 'workspace-1',
  thread_id: 'thread-1',
  lead_id: 'lead-1',
  campaign_id: 'campaign-1',
  direction: 'outbound',
  sender_type: 'sdr_ai',
  sender_name: 'SDR Expert',
  message_text: 'Mensagem base.',
  model_name: null,
  prompt_purpose: null,
  sentiment_tag: null,
  intent_tag: null,
  generated_by: 'openai',
  token_usage: null,
  created_at: '2026-04-23T15:00:00.000Z',
};

function makeMessage(input: Partial<ConversationMessage> & Pick<ConversationMessage, 'id' | 'direction'>): ConversationMessage {
  return {
    ...baseMessage,
    ...input,
  };
}

describe('conversation message ordering', () => {
  it('ordena por data crescente', () => {
    const ordered = sortConversationMessages([
      makeMessage({ id: 'later', direction: 'outbound', created_at: '2026-04-23T15:02:00.000Z' }),
      makeMessage({ id: 'earlier', direction: 'outbound', created_at: '2026-04-23T15:01:00.000Z' }),
    ]);

    expect(ordered.map((message) => message.id)).toEqual(['earlier', 'later']);
  });

  it('coloca resposta do cliente antes da IA quando o timestamp empata', () => {
    const sameTimestamp = '2026-04-23T15:00:00.000Z';
    const ordered = sortConversationMessages([
      makeMessage({ id: 'outbound-ai', direction: 'outbound', created_at: sameTimestamp }),
      makeMessage({ id: 'inbound-client', direction: 'inbound', sender_type: 'client', created_at: sameTimestamp }),
    ]);

    expect(ordered.map((message) => message.direction)).toEqual(['inbound', 'outbound']);
  });
});
