import { describe, expect, it } from 'vitest';
import { buildStageAutomationErrorWarning, buildStageAutomationFeedback } from './stage-automation-feedback';

describe('stage automation feedback', () => {
  it('mantem apenas a mensagem principal quando nao houve geracao nem falha', () => {
    expect(
      buildStageAutomationFeedback({
        successMessage: 'Lead movido para Tentando Contato',
        failurePrefix: 'Lead movido, mas o gatilho automatico falhou em',
        automation: {
          generatedCampaignNames: [],
          skippedCampaignNames: [],
          failedCampaigns: [],
        },
      }),
    ).toEqual({
      notice: 'Lead movido para Tentando Contato.',
      warning: null,
    });
  });

  it('anexa o resumo de campanhas geradas ao notice', () => {
    expect(
      buildStageAutomationFeedback({
        successMessage: 'Lead cadastrado',
        failurePrefix: 'Lead salvo, mas o gatilho automatico falhou em',
        automation: {
          generatedCampaignNames: ['Campanha ICP'],
          skippedCampaignNames: [],
          failedCampaigns: [],
        },
      }),
    ).toEqual({
      notice: 'Lead cadastrado. Mensagens geradas automaticamente para Campanha ICP.',
      warning: null,
    });
  });

  it('gera aviso separado quando houver falha parcial', () => {
    expect(
      buildStageAutomationFeedback({
        successMessage: 'Simulacao registrada no chat',
        failurePrefix: 'Simulacao salva, mas o gatilho automatico falhou em',
        automation: {
          generatedCampaignNames: ['Campanha A', 'Campanha B'],
          skippedCampaignNames: [],
          failedCampaigns: [{ name: 'Campanha C', error: 'timeout' }],
        },
      }),
    ).toEqual({
      notice: 'Simulacao registrada no chat. 2 campanhas geraram mensagens automaticamente.',
      warning: 'Simulacao salva, mas o gatilho automatico falhou em: Campanha C.',
    });
  });

  it('preserva a mensagem principal quando a automacao nao pode ser concluida', () => {
    expect(buildStageAutomationErrorWarning('Lead movido, mas o gatilho automatico nao pode ser concluido', new Error('Falha HTTP 502'))).toBe(
      'Lead movido, mas o gatilho automatico nao pode ser concluido. Serviço de IA indisponível nesta tentativa. Tente novamente.',
    );
  });
});
