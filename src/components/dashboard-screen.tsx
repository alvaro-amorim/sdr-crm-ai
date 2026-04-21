import { Megaphone, Send, Sparkles, Target, Users, Workflow, type LucideIcon } from 'lucide-react';
import type { CrmData } from '../types/domain';
import { findStageByName, formatDateTime, getLeadMetaLine } from '../utils/crm-ui';

type ActivityFeedItem = {
  id: string;
  title: string;
  description: string;
  at: string;
  tone: 'lead' | 'campaign' | 'message' | 'send';
};

export function DashboardScreen({ data }: { data: CrmData }) {
  const activeCampaigns = data.campaigns.filter((campaign) => campaign.is_active).length;
  const leadsInContactStage = findStageByName(data.stages, 'Tentando Contato');
  const leadsInContact = leadsInContactStage
    ? data.leads.filter((lead) => lead.current_stage_id === leadsInContactStage.id).length
    : 0;
  const sentCount = data.sentMessageEvents.length;
  const stageCounts = data.stages.map((stage) => ({
    stage,
    count: data.leads.filter((lead) => lead.current_stage_id === stage.id).length,
  }));
  const maxStageCount = Math.max(1, ...stageCounts.map((item) => item.count));
  const leadsById = new Map(data.leads.map((lead) => [lead.id, lead]));
  const campaignsById = new Map(data.campaigns.map((campaign) => [campaign.id, campaign]));

  const recentActivity: ActivityFeedItem[] = [
    ...data.sentMessageEvents.map((event) => {
      const lead = leadsById.get(event.lead_id);
      const campaign = campaignsById.get(event.campaign_id);
      return {
        id: `send-${event.id}`,
        title: `Envio simulado para ${lead?.name ?? 'lead'}`,
        description: campaign ? `Campanha ${campaign.name}` : 'Envio registrado no histórico comercial.',
        at: event.sent_at,
        tone: 'send' as const,
      };
    }),
    ...data.generatedMessages.map((message) => {
      const lead = leadsById.get(message.lead_id);
      return {
        id: `message-${message.id}`,
        title: `Mensagem IA gerada para ${lead?.name ?? 'lead'}`,
        description: message.message_text,
        at: message.created_at,
        tone: 'message' as const,
      };
    }),
    ...data.leads.map((lead) => ({
      id: `lead-${lead.id}`,
      title: `Lead ${lead.name} entrou no workspace`,
      description: getLeadMetaLine(lead),
      at: lead.created_at,
      tone: 'lead' as const,
    })),
    ...data.campaigns.map((campaign) => ({
      id: `campaign-${campaign.id}`,
      title: `Campanha ${campaign.name} preparada`,
      description: campaign.is_active ? 'Campanha ativa e pronta para gerar mensagens.' : 'Campanha salva como inativa.',
      at: campaign.updated_at,
      tone: 'campaign' as const,
    })),
  ]
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    .slice(0, 6);

  return (
    <section className="stack">
      <section className="dashboard-hero panel">
        <div className="dashboard-hero-copy">
          <span className="section-kicker">Operação comercial</span>
          <h1>Dashboard</h1>
          <p>
            {data.workspace.name} centraliza leads, campanhas e mensagens para o avaliador enxergar o fluxo completo do
            SDR em uma única leitura.
          </p>
        </div>
        <div className="dashboard-hero-highlights">
          <div>
            <small>Próxima leitura útil</small>
            <strong>{activeCampaigns > 0 ? 'Campanhas prontas para abordagem' : 'Crie a primeira campanha ativa'}</strong>
          </div>
          <div>
            <small>Status do funil</small>
            <strong>{leadsInContact} lead(s) já em Tentando Contato</strong>
          </div>
        </div>
      </section>

      <div className="metric-grid metric-grid-large">
        <Metric
          icon={Users}
          label="Leads no workspace"
          value={data.leads.length}
          helper="Volume total disponível para qualificação."
        />
        <Metric
          icon={Workflow}
          label="Campanhas ativas"
          value={activeCampaigns}
          helper="Playbooks prontos para acionar a geração."
        />
        <Metric
          icon={Sparkles}
          label="Mensagens geradas"
          value={data.generatedMessages.length}
          helper="Mensagens produzidas pela Edge Function de IA."
        />
        <Metric
          icon={Target}
          label="Leads em contato"
          value={leadsInContact}
          helper="Leads já movidos para a etapa Tentando Contato."
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel dashboard-funnel-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Funil atual</span>
              <h2>Leads por etapa</h2>
            </div>
            <span className="panel-meta">{sentCount} envio(s) simulados já registrados</span>
          </div>
          <div className="stage-bars stage-bars-rich">
            {stageCounts.map(({ stage, count }) => (
              <div key={stage.id} className="stage-bar stage-bar-rich">
                <div className="stage-bar-copy">
                  <strong>{stage.name}</strong>
                  <span>{count} lead(s) nesta etapa</span>
                </div>
                <div className="stage-bar-track" aria-hidden>
                  <div className="stage-bar-fill" style={{ width: `${Math.max((count / maxStageCount) * 100, count > 0 ? 14 : 0)}%` }} />
                </div>
                <strong className="stage-bar-total">{count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Narrativa da operação</span>
              <h2>Atividade recente</h2>
            </div>
            <span className="panel-meta">Últimos movimentos reais do workspace</span>
          </div>
          {recentActivity.length === 0 ? (
            <p className="empty">Ainda não há atividade recente para exibir.</p>
          ) : (
            <div className="activity-feed">
              {recentActivity.map((item) => (
                <article key={item.id} className={`activity-item activity-item-${item.tone}`}>
                  <div className="activity-icon" aria-hidden>
                    {item.tone === 'lead' ? <Users /> : item.tone === 'campaign' ? <Megaphone /> : item.tone === 'message' ? <Sparkles /> : <Send />}
                  </div>
                  <div className="activity-copy">
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <time dateTime={item.at}>{formatDateTime(item.at)}</time>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <article className="metric">
      <div className="metric-topline">
        <span>{label}</span>
        <Icon aria-hidden />
      </div>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}
