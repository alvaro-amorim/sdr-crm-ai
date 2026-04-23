import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  FileText,
  MessageCircleReply,
  Megaphone,
  Send,
  Sparkles,
  Target,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Campaign, ConversationMessage, ConversationThread, CrmData, Lead, PipelineStage } from '../types/domain';
import { findStageByName, formatDateTime, getLeadMetaLine } from '../utils/crm-ui';

type ActivityFeedItem = {
  id: string;
  title: string;
  description: string;
  at: string;
  tone: 'lead' | 'campaign' | 'message' | 'send' | 'reply';
};

type OperationShortcutKey =
  | 'no_response'
  | 'secondary_follow_up'
  | 'negative'
  | 'positive'
  | 'qualified'
  | 'meeting'
  | 'active_campaigns'
  | 'risk';

type OperationTone = 'neutral' | 'warning' | 'positive' | 'danger' | 'meeting';

type OperationLeadRow = {
  id: string;
  lead: Lead;
  stage: PipelineStage | null;
  campaign: Campaign | null;
  thread: ConversationThread | null;
  latestMessage: ConversationMessage | null;
  latestInboundMessage: ConversationMessage | null;
  latestOutboundMessage: ConversationMessage | null;
  sortAt: string;
};

type OperationShortcut = {
  key: OperationShortcutKey;
  title: string;
  value: number;
  description: string;
  meta: string;
  recommendedAction: string;
  tone: OperationTone;
  icon: LucideIcon;
  rows: OperationLeadRow[];
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

function sortByNewest<T extends { sortAt: string }>(items: T[]) {
  return [...items].sort((left, right) => new Date(right.sortAt).getTime() - new Date(left.sortAt).getTime());
}

function getMessagePreview(message: ConversationMessage | null) {
  if (!message) return 'Sem mensagem registrada nesta conversa.';
  return message.message_text.length > 180 ? `${message.message_text.slice(0, 180)}...` : message.message_text;
}

function getLatestMessageByDirection(messages: ConversationMessage[], direction: ConversationMessage['direction']) {
  return messages
    .filter((message) => message.direction === direction)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] ?? null;
}

function getThreadLabel(thread: ConversationThread | null) {
  if (!thread) return 'Sem conversa';
  const statusLabels: Record<ConversationThread['status'], string> = {
    closed: 'Fechada',
    meeting_scheduled: 'Reunião sinalizada',
    negative: 'Negativa',
    neutral: 'Neutra',
    open: 'Aberta',
    positive: 'Positiva',
  };
  const sentimentLabels: Record<ConversationThread['sentiment_tag'], string> = {
    mixed: 'mista',
    negative: 'negativa',
    neutral: 'neutra',
    positive: 'positiva',
  };
  return `${statusLabels[thread.status]} · ${sentimentLabels[thread.sentiment_tag]}`;
}

function getPredominantStage(rows: OperationLeadRow[]) {
  if (rows.length === 0) return 'Sem etapa';
  const counts = rows.reduce<Map<string, { name: string; count: number }>>((map, row) => {
    const name = row.stage?.name ?? 'Sem etapa';
    const current = map.get(name) ?? { name, count: 0 };
    current.count += 1;
    map.set(name, current);
    return map;
  }, new Map());
  return [...counts.values()].sort((left, right) => right.count - left.count)[0]?.name ?? 'Sem etapa';
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

export function DashboardScreen({
  data,
  onOpenLeadConversation,
}: {
  data: CrmData;
  onOpenLeadConversation: (leadId: string, campaignId?: string | null) => void;
}) {
  const [selectedStageId, setSelectedStageId] = useState(data.stages[0]?.id ?? '');
  const [insightsCollapsed, setInsightsCollapsed] = useState(false);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [activeShortcutKey, setActiveShortcutKey] = useState<OperationShortcutKey | null>(null);

  const activeCampaigns = data.campaigns.filter((campaign) => campaign.is_active).length;
  const leadsInContactStage = findStageByName(data.stages, 'Tentando Contato');
  const meetingStage = findStageByName(data.stages, 'Reunião Agendada') ?? findStageByName(data.stages, 'Reuniao Agendada');
  const qualifiedStage = findStageByName(data.stages, 'Qualificado');
  const leadsInContact = leadsInContactStage
    ? data.leads.filter((lead) => lead.current_stage_id === leadsInContactStage.id).length
    : 0;
  const meetings = meetingStage ? data.leads.filter((lead) => lead.current_stage_id === meetingStage.id).length : 0;
  const qualified = qualifiedStage ? data.leads.filter((lead) => lead.current_stage_id === qualifiedStage.id).length : 0;
  const outboundEvents = data.sentMessageEvents.filter((event) => event.direction === 'outbound');
  const inboundEvents = data.sentMessageEvents.filter((event) => event.direction === 'inbound');
  const outboundMessages = data.conversationMessages.filter((message) => message.direction === 'outbound').length;
  const threadsWithInbound = new Set(
    data.conversationMessages
      .filter((message) => message.direction === 'inbound')
      .map((message) => message.thread_id),
  ).size;
  const latestMessageByThread = data.conversationMessages.reduce<Map<string, { direction: 'outbound' | 'inbound'; created_at: string }>>(
    (map, message) => {
      const current = map.get(message.thread_id);
      if (!current || new Date(message.created_at).getTime() > new Date(current.created_at).getTime()) {
        map.set(message.thread_id, { direction: message.direction, created_at: message.created_at });
      }
      return map;
    },
    new Map(),
  );
  const positiveThreads = data.conversationThreads.filter((thread) => thread.sentiment_tag === 'positive').length;
  const negativeThreads = data.conversationThreads.filter((thread) => thread.sentiment_tag === 'negative').length;
  const meetingThreads = data.conversationThreads.filter((thread) => thread.status === 'meeting_scheduled').length;
  const followUpPendingThreads = data.conversationThreads.filter((thread) => {
    const latest = latestMessageByThread.get(thread.id);
    if (!latest || latest.direction !== 'outbound') return false;
    return thread.status !== 'meeting_scheduled' && thread.status !== 'closed' && thread.sentiment_tag !== 'negative';
  }).length;
  const realOutboundCount = outboundEvents.length;
  const realInboundCount = inboundEvents.length;
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
  const stagesById = new Map(data.stages.map((stage) => [stage.id, stage]));
  const leadsById = new Map(data.leads.map((lead) => [lead.id, lead]));
  const campaignsById = new Map(data.campaigns.map((campaign) => [campaign.id, campaign]));
  const latestConversationMessageByThread = data.conversationMessages.reduce<Map<string, ConversationMessage>>((map, message) => {
    const current = map.get(message.thread_id);
    if (!current || new Date(message.created_at).getTime() > new Date(current.created_at).getTime()) {
      map.set(message.thread_id, message);
    }
    return map;
  }, new Map());
  const messagesByThread = data.conversationMessages.reduce<Map<string, ConversationMessage[]>>((map, message) => {
    const messages = map.get(message.thread_id) ?? [];
    messages.push(message);
    map.set(message.thread_id, messages);
    return map;
  }, new Map());
  const operationalRows = data.conversationThreads
    .map<OperationLeadRow | null>((thread) => {
      const lead = leadsById.get(thread.lead_id);
      if (!lead) return null;
      const latestMessage = latestConversationMessageByThread.get(thread.id) ?? null;
      const threadMessages = messagesByThread.get(thread.id) ?? [];
      return {
        id: thread.id,
        lead,
        stage: stagesById.get(lead.current_stage_id) ?? null,
        campaign: campaignsById.get(thread.campaign_id) ?? null,
        thread,
        latestMessage,
        latestInboundMessage: getLatestMessageByDirection(threadMessages, 'inbound'),
        latestOutboundMessage: getLatestMessageByDirection(threadMessages, 'outbound'),
        sortAt: latestMessage?.created_at ?? thread.updated_at,
      };
    })
    .filter((row): row is OperationLeadRow => row !== null);
  const leadOnlyRows = data.leads.map<OperationLeadRow>((lead) => ({
    id: `lead-${lead.id}`,
    lead,
    stage: stagesById.get(lead.current_stage_id) ?? null,
    campaign: null,
    thread: null,
    latestMessage: null,
    latestInboundMessage: null,
    latestOutboundMessage: null,
    sortAt: lead.updated_at,
  }));
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
        value: followUpPendingThreads > 0 ? 'Executar follow-up' : activeCampaigns > 0 ? 'Usar playbook ativo' : 'Criar campanha ativa',
        detail: followUpPendingThreads > 0
          ? `${followUpPendingThreads} conversa(s) aguardam retorno depois da última mensagem outbound.`
          : activeCampaigns > 0
          ? 'O workspace já tem campanhas prontas para acionar a geração de mensagens.'
          : 'Sem campanha ativa, a tela de Mensagens IA perde força na demonstração.',
      },
    ];

    return insights;
  }, [activeCampaigns, bottleneck, followUpPendingThreads, meetingThreads, negativeThreads, positiveRate, positiveThreads]);

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

  const operationalShortcuts = useMemo<OperationShortcut[]>(() => {
    const openThreadRows = operationalRows.filter((row) => {
      if (!row.thread) return false;
      return row.thread.status !== 'closed' && row.thread.status !== 'meeting_scheduled' && row.thread.sentiment_tag !== 'negative';
    });
    const noResponseRows = openThreadRows.filter(
      (row) => row.latestMessage?.direction === 'outbound' && row.latestMessage.prompt_purpose === 'opening',
    );
    const secondaryFollowUpRows = openThreadRows.filter(
      (row) => row.latestMessage?.direction === 'outbound' && row.latestMessage.prompt_purpose === 'secondary_follow_up',
    );
    const negativeRows = operationalRows.filter((row) => row.thread?.sentiment_tag === 'negative' || row.thread?.status === 'negative');
    const positiveRows = operationalRows.filter(
      (row) =>
        row.thread?.sentiment_tag === 'positive' ||
        row.thread?.status === 'positive' ||
        row.thread?.status === 'meeting_scheduled',
    );
    const qualifiedRows = [
      ...leadOnlyRows.filter((row) => row.lead.current_stage_id === qualifiedStage?.id),
      ...positiveRows,
    ].filter((row, index, rows) => rows.findIndex((candidate) => candidate.lead.id === row.lead.id && candidate.thread?.id === row.thread?.id) === index);
    const meetingRows = [
      ...leadOnlyRows.filter((row) => row.lead.current_stage_id === meetingStage?.id),
      ...operationalRows.filter((row) => row.thread?.status === 'meeting_scheduled'),
    ].filter((row, index, rows) => rows.findIndex((candidate) => candidate.lead.id === row.lead.id && candidate.thread?.id === row.thread?.id) === index);
    const activeCampaignRows = operationalRows.filter((row) => row.campaign?.is_active);
    const riskRows = operationalRows.filter((row) => {
      const threadMessages = row.thread ? messagesByThread.get(row.thread.id) ?? [] : [];
      const inboundCount = threadMessages.filter((message) => message.direction === 'inbound').length;
      return (
        row.thread?.sentiment_tag === 'mixed' ||
        row.thread?.status === 'neutral' ||
        (row.latestMessage?.direction === 'outbound' && inboundCount === 0 && row.latestMessage.prompt_purpose !== 'opening') ||
        row.latestMessage?.sentiment_tag === 'negative'
      );
    });

    return [
      {
        key: 'no_response',
        title: 'Leads sem resposta',
        value: noResponseRows.length,
        description: 'Primeira abordagem enviada e nenhum retorno do cliente até agora.',
        meta: 'Prioridade de cadência',
        recommendedAction: 'Preparar follow-up secundário com referência à primeira mensagem, sem repetir a abordagem inicial.',
        tone: 'warning',
        icon: Clock3,
        rows: sortByNewest(noResponseRows),
      },
      {
        key: 'secondary_follow_up',
        title: 'Follow-up secundário pendente',
        value: secondaryFollowUpRows.length,
        description: 'Leads que já receberam retomada e ainda precisam de resposta ou decisão.',
        meta: 'Atenção operacional',
        recommendedAction: 'Revisar contexto antes de insistir novamente; priorize canais alternativos ou encerramento limpo.',
        tone: 'warning',
        icon: Send,
        rows: sortByNewest(secondaryFollowUpRows),
      },
      {
        key: 'negative',
        title: 'Recusas recentes',
        value: negativeRows.length,
        description: 'Conversas com sinal negativo ou fechamento por falta de interesse.',
        meta: 'Aprendizado do playbook',
        recommendedAction: 'Encerrar com cordialidade, preservar histórico e usar objeções recorrentes para ajustar campanhas.',
        tone: 'danger',
        icon: AlertTriangle,
        rows: sortByNewest(negativeRows),
      },
      {
        key: 'positive',
        title: 'Conversas positivas',
        value: positiveRows.length,
        description: 'Clientes com interesse, abertura para próximo passo ou reunião sinalizada.',
        meta: 'Oportunidades quentes',
        recommendedAction: 'Acelerar qualificação, confirmar dados críticos e propor agenda objetiva.',
        tone: 'positive',
        icon: MessageCircleReply,
        rows: sortByNewest(positiveRows),
      },
      {
        key: 'qualified',
        title: 'Leads em qualificação',
        value: qualifiedRows.length,
        description: 'Leads já em etapa de qualificação ou com conversa positiva.',
        meta: 'Pipeline em avanço',
        recommendedAction: 'Completar campos obrigatórios e preparar passagem para reunião ou fechamento da oportunidade.',
        tone: 'positive',
        icon: Target,
        rows: sortByNewest(qualifiedRows),
      },
      {
        key: 'meeting',
        title: 'Reuniões sinalizadas',
        value: meetingRows.length,
        description: 'Leads que chegaram à etapa de reunião ou demonstraram intenção clara de agenda.',
        meta: 'Conversão operacional',
        recommendedAction: 'Confirmar horário, responsável e próximo passo no histórico do lead.',
        tone: 'meeting',
        icon: CalendarCheck,
        rows: sortByNewest(meetingRows),
      },
      {
        key: 'active_campaigns',
        title: 'Campanhas mais ativas',
        value: activeCampaigns,
        description: 'Campanhas ativas com conversas vinculadas no workspace.',
        meta: 'Playbooks disponíveis',
        recommendedAction: 'Comparar taxa de resposta por campanha e priorizar as que geram avanço real no funil.',
        tone: 'neutral',
        icon: Megaphone,
        rows: sortByNewest(activeCampaignRows),
      },
      {
        key: 'risk',
        title: 'Risco de perda',
        value: riskRows.length,
        description: 'Conversas mistas, neutras ou com retomada sem resposta após a primeira abordagem.',
        meta: 'Prevenção de perda',
        recommendedAction: 'Ler a última mensagem, reduzir pressão comercial e oferecer saída clara para o cliente.',
        tone: 'danger',
        icon: AlertTriangle,
        rows: sortByNewest(riskRows),
      },
    ];
  }, [activeCampaigns, leadOnlyRows, meetingStage?.id, messagesByThread, operationalRows, qualifiedStage?.id]);

  const activeShortcut = operationalShortcuts.find((shortcut) => shortcut.key === activeShortcutKey) ?? null;
  const previewRow = activeShortcut?.rows[0] ?? null;

  function openLeadConversation(row: OperationLeadRow) {
    setActiveShortcutKey(null);
    onOpenLeadConversation(row.lead.id, row.campaign?.id ?? row.thread?.campaign_id ?? null);
  }

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
          icon={Send}
          label="Envios do SDR"
          value={realOutboundCount}
          helper={`${outboundMessages} mensagem(ns) outbound no histórico conversacional.`}
        />
        <Metric
          icon={MessageCircleReply}
          label="Respostas do cliente"
          value={realInboundCount}
          helper={`${threadsWithInbound} conversa(s) com resposta e ${followUpPendingThreads} aguardando follow-up ou retorno.`}
        />
        <Metric
          icon={Target}
          label="Conversas com avanço"
          value={formatPercent(positiveRate)}
          helper={`${meetings + qualified} lead(s) já chegaram em qualificação ou reunião (${formatPercent(advancedRate)} do volume total).`}
        />
      </div>

      <section className="panel dashboard-shortcuts-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Atalhos operacionais</span>
            <h2>Painel clicável da operação</h2>
          </div>
          <span className="panel-meta">Abra uma categoria para ver leads, campanhas, última mensagem e ação recomendada.</span>
        </div>
        <div className="dashboard-shortcut-grid">
          {operationalShortcuts.map((shortcut) => {
            const Icon = shortcut.icon;
            return (
              <button
                key={shortcut.key}
                type="button"
                className={`dashboard-shortcut-card dashboard-shortcut-card-${shortcut.tone}`}
                onClick={() => setActiveShortcutKey(shortcut.key)}
              >
                <span className="dashboard-shortcut-icon" aria-hidden>
                  <Icon />
                </span>
                <span className="dashboard-shortcut-copy">
                  <small>{shortcut.meta}</small>
                  <strong>{shortcut.title}</strong>
                  <span>{shortcut.description}</span>
                </span>
                <span className="dashboard-shortcut-total">{shortcut.value}</span>
                <ChevronRight className="dashboard-shortcut-chevron" aria-hidden />
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel dashboard-control-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Análise interativa</span>
            <h2>Selecionar etapa para leitura operacional</h2>
          </div>
          <label className="dashboard-stage-selector" htmlFor="dashboardStageSelector">
            Etapa analisada
            <select
              id="dashboardStageSelector"
              name="dashboardStageSelector"
              value={selectedStage?.id ?? ''}
              onChange={(event) => setSelectedStageId(event.target.value)}
            >
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
            <span className="panel-meta">{realOutboundCount} envio(s) do SDR e {realInboundCount} resposta(s) reais do cliente</span>
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
              <DiagnosticItem icon={Sparkles} title="IA" value={`${realOutboundCount} envio(s) do SDR e ${realInboundCount} resposta(s) do cliente`} />
              <DiagnosticItem icon={Target} title="Avanço" value={`${meetings + qualified} lead(s) em etapas de qualificação ou reunião`} />
            </div>
            <div className="diagnostic-actions-list">
              <h3>Próximas ações sugeridas</h3>
              <ol>
                <li>Atacar primeiro a etapa com maior concentração de leads.</li>
                <li>Priorizar os leads com última mensagem outbound e sem retorno quando houver follow-up pendente.</li>
                <li>Abrir o simulador do cliente nas conversas com sinal positivo ou misto.</li>
                <li>Revisar campos obrigatórios quando houver muito lead parado por falta de informação.</li>
              </ol>
            </div>
          </section>
        </div>
      )}

      {activeShortcut && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="dashboard-operation-title">
          <section className="chat-modal dashboard-operation-modal">
            <div className="chat-modal-header">
              <div>
                <span className="section-kicker">Drill-down operacional</span>
                <h2 id="dashboard-operation-title">{activeShortcut.title}</h2>
                <p>{activeShortcut.description}</p>
              </div>
              <button type="button" className="ghost compact icon-only" onClick={() => setActiveShortcutKey(null)} aria-label="Fechar análise operacional">
                <X aria-hidden />
              </button>
            </div>

            <div className="operation-summary-grid">
              <article>
                <span>Total</span>
                <strong>{activeShortcut.value}</strong>
                <p>{activeShortcut.meta}</p>
              </article>
              <article>
                <span>Campanhas envolvidas</span>
                <strong>{new Set(activeShortcut.rows.map((row) => row.campaign?.id).filter(Boolean)).size}</strong>
                <p>{activeShortcut.rows.find((row) => row.campaign)?.campaign?.name ?? 'Sem campanha vinculada nos exemplos.'}</p>
              </article>
              <article>
                <span>Etapa predominante</span>
                <strong>{getPredominantStage(activeShortcut.rows)}</strong>
                <p>Use esta leitura para escolher onde agir primeiro.</p>
              </article>
              <article>
                <span>Ação recomendada</span>
                <strong>Próximo passo</strong>
                <p>{activeShortcut.recommendedAction}</p>
              </article>
            </div>

            <section className="operation-modal-preview">
              <div>
                <span className="section-kicker">Prévia da conversa</span>
                <h3>{previewRow?.lead.name ?? 'Sem lead para prévia'}</h3>
              </div>
              {previewRow ? (
                <>
                  <div className="operation-message-pair">
                    <article>
                      <span>Cliente</span>
                      <p>{getMessagePreview(previewRow.latestInboundMessage)}</p>
                    </article>
                    <article>
                      <span>SDR</span>
                      <p>{getMessagePreview(previewRow.latestOutboundMessage)}</p>
                    </article>
                  </div>
                  <button type="button" className="secondary compact" onClick={() => openLeadConversation(previewRow)}>
                    <MessageCircleReply aria-hidden />
                    Ver conversa deste lead
                  </button>
                </>
              ) : (
                <p>Sem conversa registrada nesta categoria.</p>
              )}
            </section>

            {activeShortcut.rows.length === 0 ? (
              <div className="empty-panel">
                <FileText aria-hidden />
                <div>
                  <strong>Nenhum item nesta categoria agora.</strong>
                  <p>A categoria continua disponível para quando houver dados suficientes no workspace.</p>
                </div>
              </div>
            ) : (
              <div className="operation-row-list">
                {activeShortcut.rows.slice(0, 24).map((row) => (
                  <article key={row.id} className="operation-row">
                    <div className="operation-row-main">
                      <strong>{row.lead.name}</strong>
                      <span>{getLeadMetaLine(row.lead)}</span>
                      <div className="operation-row-messages">
                        <p><strong>Cliente:</strong> {getMessagePreview(row.latestInboundMessage)}</p>
                        <p><strong>SDR:</strong> {getMessagePreview(row.latestOutboundMessage)}</p>
                      </div>
                    </div>
                    <div className="operation-row-tags">
                      <span>{row.stage?.name ?? 'Sem etapa'}</span>
                      <span>{row.campaign?.name ?? 'Sem campanha'}</span>
                      <span>{getThreadLabel(row.thread)}</span>
                    </div>
                    <div className="operation-row-actions">
                      <time dateTime={row.sortAt}>{formatDateTime(row.sortAt)}</time>
                      <button type="button" className="ghost compact" onClick={() => openLeadConversation(row)}>
                        Ver conversa
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
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
