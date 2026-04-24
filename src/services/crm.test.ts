import { describe, expect, it } from 'vitest';
import { filterTriggerableCampaigns } from './crm';
import type { Campaign } from '../types/domain';

function createCampaign(id: string, name: string): Campaign {
  const now = new Date().toISOString();

  return {
    id,
    workspace_id: 'workspace-1',
    name,
    context_text: 'Contexto',
    generation_prompt: 'Prompt',
    trigger_stage_id: 'stage-1',
    ai_response_mode: 'always',
    ai_response_window_start: '09:00:00',
    ai_response_window_end: '18:00:00',
    is_active: true,
    created_by: 'user-1',
    created_at: now,
    updated_at: now,
  };
}

describe('filterTriggerableCampaigns', () => {
  it('mantem elegiveis apenas as campanhas sem historico nem skip', () => {
    const campaignA = createCampaign('campaign-a', 'Campanha A');
    const campaignB = createCampaign('campaign-b', 'Campanha B');
    const campaignC = createCampaign('campaign-c', 'Campanha C');

    const result = filterTriggerableCampaigns({
      campaigns: [campaignA, campaignB, campaignC],
      existingCampaignIds: new Set(['campaign-b']),
      skipCampaignIds: ['campaign-c'],
    });

    expect(result.eligible.map((campaign) => campaign.id)).toEqual(['campaign-a']);
    expect(result.skipped.map((campaign) => campaign.id)).toEqual(['campaign-b', 'campaign-c']);
  });
});
