import { describe, expect, it } from 'vitest';
import { getDeterministicConversationOutcome, mergeConversationVerdict, normalizeConversationText } from './conversation-verdict';

describe('conversation verdict', () => {
  it('normaliza texto com acentos', () => {
    expect(normalizeConversationText('Não é prioridade agora.')).toBe('nao e prioridade agora.');
  });

  it('forca veredito negativo para recusa clara', () => {
    expect(
      getDeterministicConversationOutcome(
        'Oi, Lucas. Agradeço o contato, mas no momento não é uma prioridade. Estamos focados em outras demandas e não conseguimos abrir espaço agora.',
      ),
    ).toMatchObject({
      sentiment_tag: 'negative',
      thread_status: 'negative',
      lead_stage_action: 'desqualificado',
      should_close: true,
      intent_tag: 'closing_note',
    });
  });

  it('forca veredito de reuniao quando o cliente aceita agenda', () => {
    expect(getDeterministicConversationOutcome('Podemos marcar uma reunião na quinta? Me manda um horário.')).toMatchObject({
      sentiment_tag: 'positive',
      thread_status: 'meeting_scheduled',
      lead_stage_action: 'reuniao_agendada',
      should_close: false,
      intent_tag: 'meeting_confirmation',
    });
  });

  it('mantem a classificacao da IA quando nao ha override deterministico', () => {
    expect(
      mergeConversationVerdict('Pode me mandar mais detalhes antes de marcarmos?', {
        message_text: 'Claro. Posso mandar um resumo com casos parecidos e depois alinhamos a conversa.',
        sentiment_tag: 'positive',
        intent_tag: 'qualification_follow_up',
        thread_status: 'positive',
        lead_stage_action: 'qualificado',
        should_close: false,
      }),
    ).toMatchObject({
      sentiment_tag: 'positive',
      thread_status: 'positive',
      lead_stage_action: 'qualificado',
      should_close: false,
      intent_tag: 'qualification_follow_up',
    });
  });
});
