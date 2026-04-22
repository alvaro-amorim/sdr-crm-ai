import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronUp,
  MessageCircleReply,
  Megaphone,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CrmData, Lead, PipelineStage } from '../types/domain';
import { findStageByName, formatDateTime, getLeadMetaLine } from '../utils/crm-ui';

type ActivityFeedItem = {
  id: string;
  title: string;
  description: string;
  at: string;
  tone: 'lead' | 'campaign' | 'message' | 'send' | 'reply';
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function safeRate(part: number, total: number) {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

function formatLeadCount(count: number) {
  return `${count} ${count === 1 ? 'lead' : 'leads'}`;
}

function getStageNextAction(stage: PipelineStage | null, leads: Lead[], hasCampaignTrigger: boolean) {
  if (!stage) return 'Selecione uma etapa para enxergar a ação recomendada.';
  if (leads.length === 0) return 'Etapa vazia. Ela não exige ação imediata.';
  if (hasCampaignTrigger) return 'Há campanha ligada a esta etapa. Priorize gerar mensagens para os leads parados aqui.';

  const normalized = stage.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('base')) return 'Revise origem, ICP e contato antes de acionar uma campanha.';
  if (normalized.includes('tentando')) return 'Acompanhe respostas e mova oportunidades com sinal positivo.';
  if (normalized.includes('qualificado')) return 'Converta os leads com fit em reunião agendada.';
  return 'Revise os dados da etapa e defina o próximo playbook comercial.';
}

export function DashboardScreen({ data }: { data: CrmData }) {
  const [selectedStageId, setSelectedStageId] = useState(data.stages[0]?.id ?? '');
  const [insightsCollapsed, setInsightsCollapsed] = useState(false);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);

  const activeCampaigns = data.campaigns.filter((campaign) => campaign.is_active).length;
  const leadsInContactStage = findStageByName(data.stages, 'Tentando Contato');
  const meetingStage = findStageByName(data.stages, 'Reunião Agendada') ?? findStageByName(data.stages, 'Reuniao Agendada');
  const qualifiedStage = findStageByName(data.stages, 'Qualificado');
  const leadsInContact = leadsInContactStage
    ? data.leads.filter((lead) => lead.current_stage_id === leadsInContactStage.id).length
    : 0;
  const meetings = meetingStage ? data.leads.filter((lead) => lead.current_stage_id === meetingStage.id).length : 0;
  const qualified = qualifiedStage ? data.leads.filter((lead) => lead.current_stage_id === qualifiedStage.id).length : 0;
  const sentCount = data.sentMessageEvents.length;
  const outboundMessages = data.conversationMessages.filter((message) => message.direction === 'outbound').length;
  const inboundMessages = data.conversationMessages.filter((message) => message.direction === 'inbound').length;
  const threadsWithInbound = new Set(
    data.conversationMessages
      .filter((message) => message.direction === 'inbound')
      .map((message) => message.thread_id),
  ).size;
  const positiveThreads = data.conversationThreads.filter((thread) => thread.sentiment_tag === 'positive').length;
  const negativeThreads = data.conversationThreads.filter((thread) => thread.sentiment_tag === 'negative').length;
  const meetingThreads = data.conversationThreads.filter((thread) => thread.status === 'meeting_scheduled').length;
  const responseRate = safeRate(threadsWithInbound, data.conversationThreads.length);
  const positiveRate = safeRate(positiveThreads + meetingThreads, Math.max(1, data.conversationThreads.length));
  const advancedRate = safeRate(meetings + qualified, data.leads.length);
  const stageCounts = data.stages.map((stage) => ({
    stage,
    count: data.leads.filter((lead) => lead.current_stage_id === stage.id).length,
  }));
  const maxStageCount = Math.max(1, ...stageCounts.map((item) => item.count));
  const bottleneck = stageCounts.reduce((current, item) => (item.count > current.count ? item : current), stageCounts[0] ?? null);
  const selectedStage = data.stages.find((stage) => stage.id === selectedStageId) ?? data.stages[0] ?? null;
  const selectedStageLeads = selectedStage ? data.leads.filter((lead) => lead.current_stage_id === selectedStage.id) : [];
  const selectedStageCampaigns = selectedStage
    ? data.campaigns.filter((campaign) => campaign.trigger_stage_id === selectedStage.id && campaign.is_active)
    : [];
  const leadsById = new Map(data.leads.map((lead) => [lead.id, lead]));
  const campaignsById = new Map(data.campaigns.map((campaign) => [campaign.id, campaign]));
  const mostRecentConversation = [...data.conversationMessages].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  )[0];

  const strategicInsights = useMemo(() => {
    const insights = [
      {
        title: 'Gargalo principal',
        value: bottleneck ? `${bottleneck.stage.name}: ${formatLeadCount(bottleneck.count)}` : 'Sem funil carregado',
        detail: bottleneck && bottleneck.count > 0
          ? 'Esta etapa concentra o maior volume e deve orientar a próxima ação operacional.'
          : 'Crie leads para o dashboard identificar gargalos automaticamente.',
      },
      {
        title: 'Qualidade das conversas',
        value: `${formatPercent(positiveRate)} com sinal positivo`,
        detail: `${positiveThreads} conversa(s) positivas, ${meetingThreads} reunião(ões) sinalizadas e ${negativeThreads} negativa(s).`,
      },
      {
        title: 'Ação recomendada',
        value: activeCampaigns > 0 ? 'Usar playbook ativo' : 'Criar campanha ativa',
        detail: activeCampaigns > 0
          ? 'O workspace já tem campanhas prontas para acionar a geração de mensagens.'
          : 'Sem campanha ativa, a tela de Mensagens IA perde força na demonstração.',
      },
    ];

    return insights;
  }, [activeCampaigns, bottleneck, meetingThreads, negativeThreads, positiveRate, positiveThreads]);

  const recentActivity: ActivityFeedItem[] = [
    ...data.conversationMessages.map((message) => {
      const lead = leadsById.get(message.lead_id);
      const campaign = campaignsById.get(message.campaign_id);
      return {
        id: `conversation-${message.id}`,
        title: message.direction === 'inbound' ? `Resposta de ${lead?.name ?? 'cliente'}` : `IA respondeu ${lead?.name ?? 'lead'}`,
        description: campaign ? `${campaign.name}: ${message.message_text}` : message.message_text,
        at: message.created_at,
        tone: message.direction === 'inbound' ? 'reply' as const : 'message' as const,
      };
    }),
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
    .slice(0, 8);

  return (
    <section className="stack">
      <section className="dashboard-hero panel dashboard-hero-strategic">
        <div className="dashboard-hero-copy">
          <span className="section-kicker">Cockpit comercial</span>
          <h1>Dashboard estratégico</h1>
          <p>
            {data.workspace.name} mostra volume, gargalos, respostas e sinais de conversão para orientar o próximo bloco de
            operação do SDR.
          </p>
          <div className="dashboard-hero-actions">
            <button type="button" onClick={() => setDiagnosticOpen(true)}>
              <BookOpen aria-hidden />
              Abrir diagnóstico
            </button>
            <button type="button" className="ghost" onClick={() => setInsightsCollapsed((current) => !current)}>
              {insightsCollapsed ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
              {insightsCollapsed ? 'Mostrar leitura' : 'Minimizar leitura'}
            </button>
          </div>
        </div>
        <div className="dashboard-hero-highlights">
          <div>
            <small>Próxima leitura útil</small>
            <strong>{bottleneck ? `Priorizar ${bottleneck.stage.name}` : 'Crie leads para iniciar a leitura'}</strong>
          </div>
          <div>
            <small>Status do contato</small>
            <strong>{leadsInContact} lead(s) em tentativa ativa</strong>
          </div>
          <div>
            <small>Último sinal de conversa</small>
            <strong>{mostRecentConversation ? formatDateTime(mostRecentConversation.created_at) : 'Sem conversa registrada'}</strong>
          </div>
        </div>
      </section>

      {!insightsCollapsed && (
        <section className="dashboard-insight-strip">
          {strategicInsights.map((insight) => (
            <article key={insight.title} className="strategic-insight-card">
              <span>{insight.title}</span>
              <strong>{insight.value}</strong>
              <p>{insight.detail}</p>
            </article>
          ))}
        </section>
      )}

      <div className="metric-grid metric-grid-large">
        <Metric
          icon={Users}
          label="Leads no workspace"
          value={data.leads.length}
          helper="Volume total disponível para qualificação."
        />
        <Metric
          icon={MessageCircleReply}
          label="Taxa de resposta"
          value={formatPercent(responseRate)}
          helper={`${threadsWithInbound} conversa(s) com resposta, ${inboundMessages} resposta(s) no total.`}
        />
        <Metric
          icon={TrendingUp}
          label="Sinais positivos"
          value={formatPercent(positiveRate)}
          helper="Conversas positivas ou com reunião sinalizada."
        />
        <Metric
          icon={Target}
          label="Reuniões e qualificados"
          value={meetings + qualified}
          helper={`${formatPercent(advancedRate)} do volume total já chegou em etapa avançada.`}
        />
      </div>

      <section className="panel dashboard-control-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Análise interativa</span>
            <h2>Selecionar etapa para leitura operacional</h2>
          </div>
          <label className="dashboard-stage-selector">
            Etapa analisada
            <select value={selectedStage?.id ?? ''} onChange={(event) => setSelectedStageId(event.target.value)}>
              {data.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="selected-stage-grid">
          <article className="selected-stage-card">
            <span className="section-kicker">Etapa selecionada</span>
            <strong>{selectedStage?.name ?? 'Sem etapa'}</strong>
            <p>{getStageNextAction(selectedStage, selectedStageLeads, selectedStageCampaigns.length > 0)}</p>
          </article>
          <article className="selected-stage-card">
            <span className="section-kicker">Volume</span>
            <strong>{formatLeadCount(selectedStageLeads.length)}</strong>
            <p>{selectedStageCampaigns.length} campanha(s) ativa(s) ligada(s) a esta etapa.</p>
          </article>
          <article className="selected-stage-card selected-stage-card-list">
            <span className="section-kicker">Amostra de leads</span>
            {selectedStageLeads.length === 0 ? (
              <p>Sem leads nesta etapa.</p>
            ) : (
              <ul>
                {selectedStageLeads.slice(0, 4).map((lead) => (
                  <li key={lead.id}>
                    <strong>{lead.name}</strong>
                    <span>{lead.company || 'Empresa não informada'}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </section>

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
              <button
                key={stage.id}
                type="button"
                className={stage.id === selectedStage?.id ? 'stage-bar stage-bar-rich dashboard-stage-button dashboard-stage-button-active' : 'stage-bar stage-bar-rich dashboard-stage-button'}
                onClick={() => setSelectedStageId(stage.id)}
              >
                <div className="stage-bar-copy">
                  <strong>{stage.name}</strong>
                  <span>{count} lead(s) nesta etapa</span>
                </div>
                <div className="stage-bar-track" aria-hidden>
                  <div className="stage-bar-fill" style={{ width: `${Math.max((count / maxStageCount) * 100, count > 0 ? 14 : 0)}%` }} />
                </div>
                <strong className="stage-bar-total">{count}</strong>
              </button>
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
                    {item.tone === 'lead' ? <Users /> : item.tone === 'campaign' ? <Megaphone /> : item.tone === 'message' ? <Sparkles /> : item.tone === 'reply' ? <MessageCircleReply /> : <Send />}
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

      {diagnosticOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="dashboard-diagnostic-title">
          <section className="chat-modal dashboard-diagnostic-modal">
            <div className="chat-modal-header">
              <div>
                <span className="section-kicker">Diagnóstico executivo</span>
                <h2 id="dashboard-diagnostic-title">Leitura estratégica do workspace</h2>
                <p>Resumo criado a partir dos dados reais carregados no front-end, sem inventar métricas externas.</p>
              </div>
              <button type="button" className="ghost compact icon-only" onClick={() => setDiagnosticOpen(false)} aria-label="Fechar diagnóstico">
                <X aria-hidden />
              </button>
            </div>
            <div className="diagnostic-grid">
              <DiagnosticItem icon={BarChart3} title="Gargalo" value={bottleneck ? `${bottleneck.stage.name} concentra ${formatLeadCount(bottleneck.count)}` : 'Sem gargalo detectado'} />
              <DiagnosticItem icon={MessageCircleReply} title="Engajamento" value={`${formatPercent(responseRate)} das conversas tiveram resposta`} />
              <DiagnosticItem icon={Sparkles} title="IA" value={`${outboundMessages} mensagem(ns) outbound no histórico conversacional`} />
              <DiagnosticItem icon={Target} title="Avanço" value={`${meetings + qualified} lead(s) em etapas de qualificação ou reunião`} />
            </div>
            <div className="diagnostic-actions-list">
              <h3>Próximas ações sugeridas</h3>
              <ol>
                <li>Atacar primeiro a etapa com maior concentração de leads.</li>
                <li>Usar campanhas ativas para gerar ou continuar abordagens com IA.</li>
                <li>Abrir o simulador do cliente nas conversas com sinal positivo ou misto.</li>
                <li>Revisar campos obrigatórios quando houver muito lead parado por falta de informação.</li>
              </ol>
            </div>
          </section>
        </div>
      )}
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
  value: number | string;
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

function DiagnosticItem({ icon: Icon, title, value }: { icon: LucideIcon; title: string; value: string }) {
  return (
    <article className="diagnostic-item">
      <Icon aria-hidden />
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}
