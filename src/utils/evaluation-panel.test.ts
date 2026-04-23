import { describe, expect, it } from 'vitest';
import { buildEvaluationAppUrl, isEvaluationPanelEnabled, parseAppNavigation } from './evaluation-panel';

describe('evaluation panel helpers', () => {
  it('habilita o painel quando a flag esta ativa', () => {
    expect(isEvaluationPanelEnabled(true, 'example.com')).toBe(true);
  });

  it('habilita o painel localmente mesmo sem flag', () => {
    expect(isEvaluationPanelEnabled(false, 'localhost')).toBe(true);
    expect(isEvaluationPanelEnabled(false, '127.0.0.1')).toBe(true);
  });

  it('nao habilita o painel remoto sem flag', () => {
    expect(isEvaluationPanelEnabled(false, 'sdr-crm-ai-wine.vercel.app')).toBe(false);
  });

  it('le tab e workspace da query string', () => {
    expect(parseAppNavigation('?tab=messages&workspace=workspace-1')).toEqual({
      tab: 'messages',
      workspaceId: 'workspace-1',
    });
  });

  it('faz fallback seguro quando a query e invalida', () => {
    expect(parseAppNavigation('?tab=qualquer-coisa')).toEqual({
      tab: 'dashboard',
      workspaceId: null,
    });
  });

  it('monta url do app principal com tab e workspace', () => {
    expect(buildEvaluationAppUrl('https://example.com', 'workspace-1', 'messages')).toBe(
      'https://example.com/?tab=messages&workspace=workspace-1',
    );
  });
});
