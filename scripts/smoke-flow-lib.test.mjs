import { describe, expect, it } from 'vitest';
import {
  buildSmokeAssignments,
  getSmokeExpectedMetrics,
  getSmokeScenarioByKey,
  validateScenarioConversation,
  validateScenarioThreadSummary,
} from './smoke-flow-lib.mjs';

describe('smoke-flow-lib', () => {
  it('distribui os cenarios sem perder o total solicitado', () => {
    const assignments = buildSmokeAssignments(100, 'all');
    expect(assignments).toHaveLength(100);

    const uniqueKeys = new Set(assignments);
    expect(uniqueKeys.has('opening_no_response')).toBe(true);
    expect(uniqueKeys.has('secondary_follow_up_no_response')).toBe(true);
    expect(uniqueKeys.has('meeting_confirmed')).toBe(true);
  });

  it('limita a onda 1 aos cenarios sem resposta', () => {
    const assignments = buildSmokeAssignments(20, '1');
    expect(new Set(assignments)).toEqual(
      new Set(['opening_no_response', 'secondary_follow_up_no_response']),
    );
  });

  it('calcula metricas esperadas a partir dos cenarios', () => {
    const metrics = getSmokeExpectedMetrics([
      'opening_no_response',
      'secondary_follow_up_no_response',
      'negative_closed',
    ]);

    expect(metrics.threads).toBe(3);
    expect(metrics.outboundMessages).toBe(5);
    expect(metrics.inboundMessages).toBe(1);
    expect(metrics.generatedMessages).toBe(5);
    expect(metrics.sentMessageEvents).toBe(6);
    expect(metrics.conversationMessages).toBe(6);
  });

  it('valida a sequencia correta de uma abordagem secundaria sem resposta', () => {
    expect(() =>
      validateScenarioConversation(
        [
          { direction: 'outbound', message_text: 'Primeira mensagem.', prompt_purpose: 'opening' },
          { direction: 'outbound', message_text: 'Retomada amigavel.', prompt_purpose: 'secondary_follow_up' },
        ],
        'secondary_follow_up_no_response',
      ),
    ).not.toThrow();
  });

  it('rejeita direcao invalida na sequencia do smoke', () => {
    expect(() =>
      validateScenarioConversation(
        [
          { direction: 'outbound', message_text: 'Primeira mensagem.' },
          { direction: 'inbound', message_text: 'Resposta indevida.' },
        ],
        'secondary_follow_up_no_response',
      ),
    ).toThrow(/direcao invalida/i);
  });

  it('rejeita prompt_purpose invalido no follow-up sem resposta', () => {
    expect(() =>
      validateScenarioConversation(
        [
          { direction: 'outbound', message_text: 'Primeira mensagem.', prompt_purpose: 'opening' },
          { direction: 'outbound', message_text: 'Retomada amigavel.', prompt_purpose: 'opening' },
        ],
        'secondary_follow_up_no_response',
      ),
    ).toThrow(/prompt_purpose invalido/i);
  });

  it('valida o resumo final esperado para reuniao agendada', () => {
    const scenario = getSmokeScenarioByKey('meeting_confirmed');

    expect(() =>
      validateScenarioThreadSummary(
        {
          threadId: 'thread-1',
          threadStatus: scenario.threadStatus,
          threadSentiment: scenario.threadSentiment,
          leadStageName: scenario.resultStageName,
          leadName: 'Lead Demo',
        },
        scenario.key,
      ),
    ).not.toThrow();
  });
});
