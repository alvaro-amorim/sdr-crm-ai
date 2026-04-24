import { Activity, Building2, Clock3, ExternalLink, MessageCircleReply, MessageSquareText, Search, Send, Sparkles, Workflow, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { resolveNextOutboundPurpose } from '../lib/conversation-verdict';
import { supabase, supabaseEnv } from '../lib/supabase';
import { moveLead, runStageTriggerAutomation, type StageTriggerAutomationResult } from '../services/crm';
import type {
  Campaign,
  ConversationMessage,
  ConversationThread,
  CrmData,
  GeneratedMessage,
  Lead,
  PipelineStage,
  SentMessageEvent,
} from '../types/domain';
import { sortConversationMessages } from '../utils/conversation';
import { findStageByName, formatDateTime, getLeadChannel, getLeadMetaLine } from '../utils/crm-ui';
import { getErrorMessage } from '../utils/error-messages';
import { rankLeadOptions, toLeadSearchOption } from '../utils/lead-search';
import { buildStageAutomationErrorWarning } from '../utils/stage-automation-feedback';

export type MessageFocusTarget = {
  leadId: string;
  campaignId?: string | null;
  nonce: number;
};

function formatDeliveryStatus(status: SentMessageEvent['delivery_status']) {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'scheduled':
      return 'Agendada';
    case 'sent':
      return 'Enviada';
    case 'delivered':
      return 'Entregue';
    case 'read':
      return 'Lida';
    case 'replied':
      return 'Respondida';
    default:
      return 'Registrada';
  }
}

const MESSAGE_MAX_LENGTH = 2000;

type PersistedMessageSelection = {
  leadId?: string;
  campaignId?: string;
};

function getMessageSelectionStorageKey(workspaceId: string) {
  return `sdr-expert:messages-selection:${workspaceId}`;
}

function readMessageSelection(workspaceId: string): PersistedMessageSelection {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(getMessageSelectionStorageKey(workspaceId));
    return raw ? (JSON.parse(raw) as PersistedMessageSelection) : {};
  } catch {
    return {};
  }
}

function writeMessageSelection(workspaceId: string, selection: PersistedMessageSelection) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(getMessageSelectionStorageKey(workspaceId), JSON.stringify(selection));
}

function normalizeMessageDraft(text: string) {
  return text.trim();
}

async function invokeAuthenticatedFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase || !supabaseEnv) {
    throw new Error('Supabase não configurado.');
  }

  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) {
    throw new Error('Sessão expirada. Entre novamente.');
  }

  const response = await fetch(`${supabaseEnv.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseEnv.VITE_SUPABASE_ANON_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? `Falha HTTP ${response.status}.`);
  }

  return payload as T;
}

function inferChannelLabel(channel: string | null | undefined, lead: Lead) {
  if (!channel) return getLeadChannel(lead);

  switch (channel.toLowerCase()) {
    case 'email':
      return 'E-mail simulado';
    case 'whatsapp':
      return 'WhatsApp simulado';
    case 'linkedin':
      return 'LinkedIn simulado';
    default:
      return channel;
  }
}

function inferChannelKey(lead: Lead) {
  if (lead.phone) return 'whatsapp';
  if (lead.email) return 'email';
  return 'linkedin';
}

function sortByLabel<T>(items: T[], getLabel: (item: T) => string) {
  return [...items].sort((left, right) => getLabel(left).localeCompare(getLabel(right), 'pt-BR'));
}

function formatPromptPurposeLabel(promptPurpose: string | null | undefined) {
  switch (promptPurpose) {
    case 'opening':
      return 'Abertura';
    case 'secondary_follow_up':
      return 'Abordagem secundária';
    case 'qualification_follow_up':
      return 'Qualificação';
    case 'closing_note':
      return 'Encerramento';
    case 'meeting_confirmation':
      return 'Confirmação de reunião';
    default:
      return 'Fluxo ativo';
  }
}

export function MessagesScreen({
  data,
  user,
  onReload,
  setError,
  setNotice,
  focusTarget,
}: {
  data: CrmData;
  user: User;
  onReload: () => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
  focusTarget?: MessageFocusTarget | null;
}) {
  const activeCampaigns = useMemo(
    () => sortByLabel(data.campaigns.filter((campaign) => campaign.is_active), (campaign) => campaign.name),
    [data.campaigns],
  );
  const [leadId, setLeadId] = useState(() => {
    const selection = readMessageSelection(data.workspace.id);
    return selection.leadId && data.leads.some((lead) => lead.id === selection.leadId) ? selection.leadId : '';
  });
  const [leadQuery, setLeadQuery] = useState('');
  const [leadSelectorOpen, setLeadSelectorOpen] = useState(false);
  const [campaignId, setCampaignId] = useState(() => {
    const selection = readMessageSelection(data.workspace.id);
    return selection.campaignId && activeCampaigns.some((campaign) => campaign.id === selection.campaignId)
      ? selection.campaignId
      : activeCampaigns[0]?.id ?? '';
  });
  const [consumedFocusNonce, setConsumedFocusNonce] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState<GeneratedMessage | null>(null);
  const [simulationBusy, setSimulationBusy] = useState(false);
  const [simulatorLinkBusy, setSimulatorLinkBusy] = useState(false);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [loadedSelectionWorkspaceId, setLoadedSelectionWorkspaceId] = useState(data.workspace.id);
  const selectedLead = data.leads.find((lead) => lead.id === leadId) ?? null;
  const selectedCampaign = data.campaigns.find((campaign) => campaign.id === campaignId) ?? null;
  const selectedStage = selectedLead ? data.stages.find((stage) => stage.id === selectedLead.current_stage_id) ?? null : null;
  const targetStage = findStageByName(data.stages, 'Tentando Contato');
  const leadOptions = useMemo(() => rankLeadOptions(leadQuery, data.leads), [data.leads, leadQuery]);
  const leadMessages = data.generatedMessages
    .filter((message) => message.generation_status === 'generated' && message.lead_id === leadId && (!campaignId || message.campaign_id === campaignId))
    .sort((left, right) => left.variation_index - right.variation_index);
  const leadTimeline = data.sentMessageEvents
    .filter((event) => event.lead_id === leadId)
    .sort((left, right) => new Date(left.sent_at).getTime() - new Date(right.sent_at).getTime());
  const selectedCampaignThread = data.conversationThreads.find((thread) => thread.lead_id === leadId && (!campaignId || thread.campaign_id === campaignId)) ?? null;
  const activeSimulatorThread = selectedCampaignThread;
  const activeSimulatorThreadMessages = activeSimulatorThread
    ? sortConversationMessages(data.conversationMessages.filter((message) => message.thread_id === activeSimulatorThread.id))
    : [];

  useEffect(() => {
    if (!leadId || data.leads.some((lead) => lead.id === leadId)) return;
    setLeadId('');
    setLeadQuery('');
  }, [data.leads, leadId]);

  useEffect(() => {
    const selection = readMessageSelection(data.workspace.id);
    const storedLeadId = selection.leadId && data.leads.some((lead) => lead.id === selection.leadId) ? selection.leadId : '';
    const storedCampaignId =
      selection.campaignId && activeCampaigns.some((campaign) => campaign.id === selection.campaignId)
        ? selection.campaignId
        : activeCampaigns[0]?.id ?? '';

    setLeadId(storedLeadId);
    setCampaignId(storedCampaignId);
    setLeadSelectorOpen(false);
    setLoadedSelectionWorkspaceId(data.workspace.id);
  }, [data.workspace.id]);

  useEffect(() => {
    if (loadedSelectionWorkspaceId !== data.workspace.id) return;
    writeMessageSelection(data.workspace.id, { leadId, campaignId });
  }, [campaignId, data.workspace.id, leadId, loadedSelectionWorkspaceId]);

  useEffect(() => {
    if (!selectedLead) {
      return;
    }

    setLeadQuery(toLeadSearchOption(selectedLead).label);
  }, [selectedLead]);

  useEffect(() => {
    if (!focusTarget) return;
    if (consumedFocusNonce === focusTarget.nonce) return;

    const focusedLead = data.leads.find((lead) => lead.id === focusTarget.leadId);
    if (!focusedLead) return;

    setLeadId(focusedLead.id);
    setLeadQuery(toLeadSearchOption(focusedLead).label);
    setLeadSelectorOpen(false);

    if (focusTarget.campaignId && data.campaigns.some((campaign) => campaign.id === focusTarget.campaignId)) {
      setCampaignId(focusTarget.campaignId);
      setConsumedFocusNonce(focusTarget.nonce);
      return;
    }

    const leadThread = data.conversationThreads.find((thread) => thread.lead_id === focusedLead.id);
    if (leadThread && data.campaigns.some((campaign) => campaign.id === leadThread.campaign_id)) {
      setCampaignId(leadThread.campaign_id);
    }

    setConsumedFocusNonce(focusTarget.nonce);
  }, [consumedFocusNonce, data.campaigns, data.conversationThreads, data.leads, focusTarget]);

  useEffect(() => {
    if (campaignId && activeCampaigns.some((campaign) => campaign.id === campaignId)) return;
    setCampaignId(activeCampaigns[0]?.id ?? '');
  }, [activeCampaigns, campaignId]);

  useEffect(() => {
    const pendingMessageIds = new Set(
      data.generatedMessages.filter((message) => message.generation_status === 'generated').map((message) => message.id),
    );

    setMessageDrafts((current) => {
      let changed = false;
      const next: Record<string, string> = {};

      for (const [messageId, draft] of Object.entries(current)) {
        if (pendingMessageIds.has(messageId)) {
          next[messageId] = draft;
        } else {
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [data.generatedMessages]);

  function handleLeadQueryChange(value: string) {
    setLeadQuery(value);
    setLeadSelectorOpen(true);
    setLeadId('');
  }

  function selectLead(lead: Lead) {
    setLeadId(lead.id);
    setLeadQuery(toLeadSearchOption(lead).label);
    setLeadSelectorOpen(false);

    const selectedCampaignStillValid = campaignId && data.campaigns.some((campaign) => campaign.id === campaignId && campaign.is_active);
    const leadThread = data.conversationThreads.find((thread) => thread.lead_id === lead.id);
    if (!selectedCampaignStillValid && leadThread && data.campaigns.some((campaign) => campaign.id === leadThread.campaign_id && campaign.is_active)) {
      setCampaignId(leadThread.campaign_id);
    }
  }

  function getMessageDraft(message: GeneratedMessage) {
    return messageDrafts[message.id] ?? message.message_text;
  }

  function updateMessageDraft(messageId: string, value: string) {
    setMessageDrafts((current) => ({
      ...current,
      [messageId]: value.slice(0, MESSAGE_MAX_LENGTH),
    }));
  }

  function openSimulation(message: GeneratedMessage) {
    const messageText = normalizeMessageDraft(getMessageDraft(message));

    if (!messageText) {
      setError('Escreva uma mensagem antes de simular o envio.');
      return;
    }

    setError(null);
    setSimulationMessage({ ...message, message_text: messageText });
  }

  async function generateMessages() {
    if (!supabase || !leadId || !campaignId) {
      setError('Selecione lead e campanha ativa.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await invokeAuthenticatedFunction('generate-lead-messages', {
        workspace_id: data.workspace.id,
        lead_id: leadId,
        campaign_id: campaignId,
      });

      setNotice('Mensagens geradas e salvas.');
      await onReload();
    } catch (generateError) {
      setError(getErrorMessage(generateError, 'ai'));
    } finally {
      setBusy(false);
    }
  }

  async function simulateSend(message: GeneratedMessage) {
    if (!supabase) return;
    const messageText = normalizeMessageDraft(message.message_text);
    if (!messageText) {
      setError('Escreva uma mensagem antes de confirmar o envio.');
      return;
    }

    if (!targetStage) {
      setError('Etapa Tentando Contato não encontrada.');
      return;
    }

    const messageLead = data.leads.find((lead) => lead.id === message.lead_id) ?? selectedLead;
    if (!messageLead) {
      setError('Lead da mensagem não encontrado.');
      return;
    }

    setError(null);

    try {
      setSimulationBusy(true);
      const existingThread =
        data.conversationThreads.find((thread) => thread.lead_id === message.lead_id && thread.campaign_id === message.campaign_id) ?? null;
      const threadMessages = existingThread
        ? sortConversationMessages(data.conversationMessages.filter((conversationMessage) => conversationMessage.thread_id === existingThread.id))
        : [];
      const promptPurpose = resolveNextOutboundPurpose({
        history: threadMessages.map((conversationMessage) => ({
          direction: conversationMessage.direction,
          sentiment_tag: conversationMessage.sentiment_tag,
          prompt_purpose: conversationMessage.prompt_purpose,
          intent_tag: conversationMessage.intent_tag,
        })),
        threadStatus: existingThread?.status,
      });
      let threadId = existingThread?.id ?? null;

      if (!threadId) {
        const { data: createdThread, error: threadError } = await supabase
          .from('conversation_threads')
          .insert({
            workspace_id: data.workspace.id,
            lead_id: message.lead_id,
            campaign_id: message.campaign_id,
            title: `${messageLead.name} · ${selectedCampaign?.name ?? 'Campanha ativa'}`,
            channel: inferChannelKey(messageLead),
            status: 'open',
            sentiment_tag: 'neutral',
            simulation_enabled: true,
            created_by: user.id,
          })
          .select()
          .single();

        if (threadError || !createdThread) {
          throw threadError ?? new Error('Falha ao criar a conversa simulada.');
        }

        threadId = createdThread.id;
      }

      if (!threadId) {
        throw new Error('Thread de conversa nao resolvida para o envio simulado.');
      }

      const { error: eventError } = await supabase.from('sent_message_events').insert({
        workspace_id: data.workspace.id,
        lead_id: message.lead_id,
        campaign_id: message.campaign_id,
        generated_message_id: message.id,
        message_text: messageText,
        sent_by_user_id: user.id,
        is_simulated: true,
        direction: 'outbound',
        sender_name: 'SDR Expert',
        channel: inferChannelKey(messageLead),
        delivery_status: 'sent',
      });

      if (eventError) throw eventError;

      const { error: messageError } = await supabase
        .from('generated_messages')
        .update({ message_text: messageText, generation_status: 'sent' })
        .eq('workspace_id', data.workspace.id)
        .eq('id', message.id);

      if (messageError) throw messageError;

      const { error: conversationError } = await supabase.from('conversation_messages').insert({
        workspace_id: data.workspace.id,
        thread_id: threadId,
        lead_id: message.lead_id,
        campaign_id: message.campaign_id,
        direction: 'outbound',
        sender_type: 'sdr_ai',
        sender_name: 'SDR Expert',
        message_text: messageText,
        prompt_purpose: promptPurpose,
        sentiment_tag: 'neutral',
        intent_tag: promptPurpose,
        generated_by: 'openai',
      });

      if (conversationError) throw conversationError;

      const { error: threadUpdateError } = await supabase
        .from('conversation_threads')
        .update({
          channel: inferChannelKey(messageLead),
          status: 'open',
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', data.workspace.id)
        .eq('id', threadId);

      if (threadUpdateError) throw threadUpdateError;

      await moveLead(supabase, data.workspace.id, message.lead_id, targetStage.id);

      const { error: cleanupError } = await supabase
        .from('generated_messages')
        .delete()
        .eq('workspace_id', data.workspace.id)
        .eq('lead_id', message.lead_id)
        .eq('campaign_id', message.campaign_id)
        .eq('generation_status', 'generated')
        .neq('id', message.id);

      if (cleanupError) throw cleanupError;

      let automation: StageTriggerAutomationResult = {
        generatedCampaignNames: [],
        skippedCampaignNames: [],
        failedCampaigns: [],
      };
      let automationErrorWarning: string | null = null;

      try {
        automation = await runStageTriggerAutomation(supabase, {
          workspaceId: data.workspace.id,
          leadId: message.lead_id,
          stageId: targetStage.id,
          skipCampaignIds: [message.campaign_id],
        });
      } catch (automationError) {
        automationErrorWarning = buildStageAutomationErrorWarning(
          'Simulacao salva, mas o gatilho automatico nao pode ser concluido',
          automationError,
        );
      }

      if (automationErrorWarning) {
        setError(automationErrorWarning);
      }

      setSimulationMessage(null);
      setMessageDrafts((current) => {
        const next = { ...current };
        delete next[message.id];
        return next;
      });
      const noticeParts = ['Simulação registrada no chat. Lead movido para Tentando Contato.'];
      if (automation.generatedCampaignNames.length === 1) {
        noticeParts.push(`Mensagens geradas automaticamente para ${automation.generatedCampaignNames[0]}.`);
      } else if (automation.generatedCampaignNames.length > 1) {
        noticeParts.push(`${automation.generatedCampaignNames.length} campanhas geraram mensagens automaticamente.`);
      }

      setNotice(noticeParts.join(' '));

      if (automation.failedCampaigns.length > 0) {
        setError(
          `Simulação salva, mas o gatilho automático falhou em: ${automation.failedCampaigns.map((item) => item.name).join(', ')}.`,
        );
      }

      await onReload();
    } catch (sendError) {
      setError(getErrorMessage(sendError, 'simulator'));
    } finally {
      setSimulationBusy(false);
    }
  }

  async function openClientSimulator(thread: ConversationThread | null) {
    if (!supabase || !thread) {
      setError('Nenhuma conversa com simulador disponível para este contexto.');
      return;
    }

    setSimulatorLinkBusy(true);
    setError(null);
    try {
      const result = await invokeAuthenticatedFunction<{ success: boolean; error?: string; data?: { url: string } }>('create-simulation-link', {
        workspace_id: data.workspace.id,
        thread_id: thread.id,
        origin: window.location.origin,
      });

      if (!result?.success) throw new Error(result?.error ?? 'Falha ao criar link do simulador.');
      if (!result.data?.url) throw new Error('Link do simulador não retornado.');

      window.open(result.data.url, '_blank', 'noopener,noreferrer,width=430,height=760');
    } catch (linkError) {
      setError(getErrorMessage(linkError, 'simulator'));
    } finally {
      setSimulatorLinkBusy(false);
    }
  }

  return (
    <section className="stack">
      <header className="page-header">
        <h1>Mensagens IA</h1>
        <p>Geração por lead e campanha com simulação comercial visível para avaliação.</p>
      </header>

      <section className="panel message-workbench">
        <div className="message-toolbar">
          <div className="lead-selector-field">
            <div className="lead-selector-heading">
              <label htmlFor="messageLead">Lead</label>
              <button
                type="button"
                className="ghost compact"
                onClick={() => {
                  setLeadQuery('');
                  setLeadSelectorOpen((current) => !current);
                }}
              >
                {leadSelectorOpen && !leadQuery ? 'Ocultar lista' : 'Ver todos'}
              </button>
            </div>
            <div className="autocomplete-input-shell">
              <Search aria-hidden />
              <input
                id="messageLead"
                name="messageLead"
                value={leadQuery}
                onChange={(event) => handleLeadQueryChange(event.target.value)}
                onFocus={() => setLeadSelectorOpen(true)}
                placeholder="Ex.: Contato comercial"
                autoComplete="off"
              />
            </div>
            {leadSelectorOpen && (
              <div className="lead-selector-menu" role="listbox" aria-label="Selecionar lead para conversa">
                {leadOptions.length === 0 ? (
                  <div className="lead-selector-empty">Nenhum lead encontrado para esta busca.</div>
                ) : (
                  leadOptions.map((option) => (
                    <button
                      key={option.lead.id}
                      type="button"
                      className={`lead-selector-option ${option.lead.id === leadId ? 'lead-selector-option-active' : ''}`}
                      onClick={() => selectLead(option.lead)}
                      role="option"
                      aria-selected={option.lead.id === leadId}
                    >
                      <span className="lead-selector-option-main">
                        <strong>{option.label}</strong>
                        <span>{option.subtitle}</span>
                      </span>
                      <span className="lead-selector-option-meta">
                        <small>{option.matchLabel}</small>
                        <span>{option.contact}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            <span className="field-hint">Digite para filtrar ou abra a lista e selecione explicitamente o lead.</span>
          </div>

          <label>
            Campanha ativa
            <select name="messageCampaign" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
              {activeCampaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="message-primary-action"
            onClick={generateMessages}
            disabled={busy || !leadId || data.leads.length === 0 || activeCampaigns.length === 0}
          >
            <Sparkles aria-hidden />
            {busy ? 'Gerando mensagens...' : selectedCampaignThread ? 'Gerar nova retomada' : 'Gerar mensagens'}
          </button>
        </div>

        <div className={`message-readiness-strip ${selectedLead && selectedCampaign ? 'message-readiness-ready' : ''}`}>
          <div>
            <span className="section-kicker">Leitura do fluxo</span>
            <strong>
              {selectedLead && selectedCampaign
                ? `A geração vai usar ${selectedCampaign.name} para abordar ${selectedLead.name}.`
                : 'Selecione um lead e uma campanha ativa para preparar a demonstração.'}
            </strong>
          </div>
          <span className="message-readiness-meta">
            {selectedLead ? `Canal: ${getLeadChannel(selectedLead)}` : 'Sem lead selecionado'}
            {' · '}
            {targetStage ? `Próxima etapa: ${targetStage.name}` : 'Etapa de destino indisponível'}
          </span>
        </div>

        <article className={`message-simulator-cta ${activeSimulatorThread ? 'message-simulator-cta-ready' : ''}`}>
          <span className="section-kicker">Janela do cliente</span>
          <strong>{activeSimulatorThread ? 'Simulador pronto para demonstração' : 'Confirme uma variação para abrir o simulador'}</strong>
          <p>
            {activeSimulatorThread
              ? 'Use esta janela para agir como cliente, validar o tempo de resposta da IA e mostrar a conversa em tempo real.'
              : selectedLead && selectedCampaign
                ? `A janela do cliente será criada para ${selectedCampaign.name} depois que uma variação for confirmada no mock.`
                : 'Selecione lead e campanha para preparar a experiência do cliente.'}
          </p>
          <button
            type="button"
            className="secondary message-launch-button"
            onClick={() => void openClientSimulator(activeSimulatorThread)}
            disabled={!activeSimulatorThread || simulatorLinkBusy}
          >
            <ExternalLink aria-hidden />
            {simulatorLinkBusy ? 'Abrindo simulador...' : 'Abrir simulador'}
          </button>
        </article>

        <div className="message-overview-grid">
          <article className="overview-card message-overview-card message-overview-card-lead">
            <div className="overview-card-topline">
              <span className="section-kicker">Lead selecionado</span>
              <Building2 aria-hidden />
            </div>
            {selectedLead ? (
              <>
                <strong>{selectedLead.name}</strong>
                <p>{getLeadMetaLine(selectedLead)}</p>
                <ul>
                  <li>{selectedLead.email ?? 'Sem e-mail informado'}</li>
                  <li>{selectedLead.phone ?? 'Sem telefone informado'}</li>
                  <li>Etapa atual: {selectedStage?.name ?? 'Sem etapa'}</li>
                </ul>
              </>
            ) : (
              <p className="empty">Selecione um lead para contextualizar a geração.</p>
            )}
          </article>

          <article className="overview-card message-overview-card message-overview-card-campaign">
            <div className="overview-card-topline">
              <span className="section-kicker">Campanha em uso</span>
              <Workflow aria-hidden />
            </div>
            {selectedCampaign ? (
              <>
                <strong>{selectedCampaign.name}</strong>
                <p>{selectedCampaign.context_text}</p>
                <ul>
                  <li>{selectedCampaign.is_active ? 'Campanha ativa' : 'Campanha inativa'}</li>
                  <li>{selectedCampaign.trigger_stage_id ? 'Com etapa gatilho configurada' : 'Sem etapa gatilho'}</li>
                </ul>
              </>
            ) : (
              <p className="empty">Nenhuma campanha ativa disponível para gerar mensagens.</p>
            )}
          </article>

          <article className="overview-card overview-card-accent message-overview-card message-overview-card-evaluation">
            <div className="overview-card-topline">
              <span className="section-kicker">Leitura da avaliação</span>
              <Activity aria-hidden />
            </div>
            <strong>{leadMessages.length} variação(ões) para revisar</strong>
            <p>O envio simulado abre um mock de conversa e registra o movimento real do lead no funil.</p>
            <ul>
              <li>{leadTimeline.length} interação(ões) simuladas já registradas para este lead</li>
              <li>Canal principal: {selectedLead ? getLeadChannel(selectedLead) : 'Selecione um lead'}</li>
              <li>Próxima etapa após enviar: {targetStage?.name ?? 'Tentando Contato'}</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="panel conversation-preview-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Simulador autenticável</span>
            <h2>Conversa operacional do cliente</h2>
          </div>
          <button
            type="button"
            className="ghost compact message-launch-button-inline"
            onClick={() => void openClientSimulator(activeSimulatorThread)}
            disabled={!activeSimulatorThread || simulatorLinkBusy}
          >
            <ExternalLink aria-hidden />
            {simulatorLinkBusy ? 'Abrindo...' : 'Abrir janela do cliente'}
          </button>
        </div>

        {activeSimulatorThread ? (
          <>
            <ConversationPreview
              thread={activeSimulatorThread}
              messages={activeSimulatorThreadMessages}
              lead={data.leads.find((lead) => lead.id === activeSimulatorThread.lead_id) ?? null}
              campaign={data.campaigns.find((campaign) => campaign.id === activeSimulatorThread.campaign_id) ?? null}
            />
          </>
        ) : (
          <div className="empty-panel">
            <MessageCircleReply aria-hidden />
            <div>
              <h2>Nenhuma conversa criada para esta campanha</h2>
              <p className="empty">
                Simule uma variação e confirme o envio no mock para criar a conversa operacional da campanha selecionada.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="message-grid">
        {leadMessages.length === 0 ? (
          <div className="panel empty-panel">
            <Sparkles aria-hidden />
            <div>
              <h2>{selectedLead && selectedCampaign ? 'Nenhuma variação pendente para revisar' : 'Nenhuma mensagem pronta para este contexto'}</h2>
              <p className="empty">
                {selectedLead && selectedCampaign
                  ? selectedCampaignThread
                    ? 'Este lead já tem conversa nesta campanha. Gere uma nova retomada para continuar a abordagem sem perder o histórico.'
                    : 'Gere variações para revisar, editar e simular o envio no chat.'
                  : 'Selecione um lead, uma campanha ativa e gere as variações para abrir a simulação de chat.'}
              </p>
              {selectedLead && selectedCampaign && (
                <button
                  type="button"
                  className="secondary message-empty-action"
                  onClick={generateMessages}
                  disabled={busy || data.leads.length === 0 || activeCampaigns.length === 0}
                >
                  <Sparkles aria-hidden />
                  {busy ? 'Gerando mensagens...' : selectedCampaignThread ? 'Gerar nova retomada' : 'Gerar variações'}
                </button>
              )}
            </div>
          </div>
        ) : (
          leadMessages.map((message) => {
            const draftText = getMessageDraft(message);
            const isDraftEmpty = normalizeMessageDraft(draftText).length === 0;

            return (
              <article className="message-card" key={message.id}>
              <div className="message-card-header">
                <span>Variação {message.variation_index}</span>
                <span className={`message-status message-status-${message.generation_status}`}>
                  {message.generation_status === 'sent' ? 'Enviada no mock' : 'Pronta para envio'}
                </span>
              </div>
              <label className="message-card-editor">
                Editar variação
                <textarea
                  aria-label={`Editar variação ${message.variation_index}`}
                  maxLength={MESSAGE_MAX_LENGTH}
                  value={draftText}
                  onChange={(event) => updateMessageDraft(message.id, event.target.value)}
                  disabled={simulationBusy}
                />
                <span className={`message-card-counter ${isDraftEmpty ? 'message-card-counter-error' : ''}`}>
                  {isDraftEmpty ? 'Texto vazio' : `${draftText.length}/${MESSAGE_MAX_LENGTH}`}
                </span>
              </label>
              <div className="message-card-footer">
                <div className="message-card-meta">
                  <Clock3 aria-hidden />
                  <span>Gerada em {formatDateTime(message.created_at)}</span>
                </div>
                <button type="button" onClick={() => openSimulation(message)} disabled={simulationBusy || isDraftEmpty}>
                  <MessageSquareText aria-hidden />
                  {simulationBusy ? 'Abrindo simulação...' : 'Simular no chat'}
                </button>
              </div>
              </article>
            );
          })
        )}
      </section>

      <ChatSimulationModal
        message={simulationMessage}
        lead={selectedLead}
        campaign={selectedCampaign}
        currentStage={selectedStage}
        targetStage={targetStage ?? null}
        history={leadTimeline}
        busy={simulationBusy}
        onClose={() => {
          if (!simulationBusy) setSimulationMessage(null);
        }}
        onConfirm={(message) => void simulateSend(message)}
      />

    </section>
  );
}

function ConversationPreview({
  thread,
  messages,
  lead,
  campaign,
}: {
  thread: ConversationThread;
  messages: ConversationMessage[];
  lead: Lead | null;
  campaign: Campaign | null;
}) {
  return (
    <div className="conversation-preview-layout">
      <div className="conversation-preview-meta">
        <article>
          <span className="section-kicker">Lead</span>
          <strong>{lead?.name ?? 'Lead removido'}</strong>
          <p>{lead ? getLeadMetaLine(lead) : 'Sem contexto de lead.'}</p>
        </article>
        <article>
          <span className="section-kicker">Campanha</span>
          <strong>{campaign?.name ?? 'Campanha removida'}</strong>
          <p>Status: {thread.status} · Sentimento: {thread.sentiment_tag}</p>
        </article>
      </div>

      <div className="conversation-preview-thread">
        {messages.slice(-6).map((message) => (
          <div
            key={message.id}
            className={`conversation-preview-row ${message.direction === 'inbound' ? 'conversation-preview-row-inbound' : ''}`}
          >
            <div className="conversation-preview-bubble">
              <div className="conversation-preview-bubble-header">
                <strong>{message.sender_name}</strong>
                {message.direction === 'outbound' ? (
                  <span className="conversation-purpose-chip">{formatPromptPurposeLabel(message.prompt_purpose)}</span>
                ) : null}
              </div>
              <p>{message.message_text}</p>
              <time dateTime={message.created_at}>{formatDateTime(message.created_at)}</time>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatSimulationModal({
  message,
  lead,
  campaign,
  currentStage,
  targetStage,
  history,
  busy,
  onClose,
  onConfirm,
}: {
  message: GeneratedMessage | null;
  lead: Lead | null;
  campaign: Campaign | null;
  currentStage: PipelineStage | null;
  targetStage: PipelineStage | null;
  history: SentMessageEvent[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (message: GeneratedMessage) => void;
}) {
  if (!message || !lead || !campaign) return null;

  const matchedHistory = history.find((event) => event.generated_message_id === message.id) ?? null;
  const threadItems: SentMessageEvent[] = matchedHistory
    ? history
    : [
        ...history,
        {
          id: `preview-${message.id}`,
          workspace_id: message.workspace_id,
          lead_id: message.lead_id,
          campaign_id: message.campaign_id,
          generated_message_id: message.id,
          message_text: message.message_text,
          sent_by_user_id: '',
          is_simulated: true,
          direction: 'outbound',
          sender_name: 'SDR Expert',
          channel: inferChannelKey(lead),
          delivery_status: 'draft',
          sent_at: new Date().toISOString(),
        },
      ];

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        className="chat-modal chat-simulation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-simulation-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="chat-modal-header">
          <div>
            <span className="section-kicker">Simulação comercial</span>
            <h2 id="chat-simulation-title">Mock de conversa com o lead</h2>
            <p>
              Visualização do envio em {getLeadChannel(lead)} com registro real no banco apenas quando você confirmar a
              simulação.
            </p>
          </div>
          <button type="button" className="ghost compact icon-button" onClick={onClose} aria-label="Fechar simulação">
            <X aria-hidden />
          </button>
        </header>

        <div className="chat-summary-grid">
          <article className="chat-summary-card">
            <strong>{lead.name}</strong>
            <p>{getLeadMetaLine(lead)}</p>
            <span>{lead.email ?? lead.phone ?? 'Contato não informado'}</span>
          </article>
          <article className="chat-summary-card">
            <strong>{campaign.name}</strong>
            <p>Campanha usada na geração desta mensagem.</p>
            <span>{campaign.is_active ? 'Ativa' : 'Inativa'}</span>
          </article>
          <article className="chat-summary-card">
            <strong>{matchedHistory ? 'Envio já confirmado' : 'Envio em prévia'}</strong>
            <p>
              {matchedHistory
                ? `Lead já está em ${currentStage?.name ?? targetStage?.name ?? 'etapa atual'}.`
                : `Ao confirmar, o lead será movido para ${targetStage?.name ?? 'Tentando Contato'}.`}
            </p>
            <span>Canal: {inferChannelLabel(matchedHistory?.channel, lead)}</span>
          </article>
        </div>

        <div className="chat-thread">
          {threadItems.map((item) => {
            const isPreview = item.id === `preview-${message.id}`;
            const isHighlighted = item.generated_message_id === message.id;
            const isInbound = item.direction === 'inbound';
            const senderLabel =
              item.sender_name?.trim() ||
              (isInbound ? (lead.name.includes(' ') ? lead.name.split(' ')[0] : lead.name) : 'SDR Expert');
            const statusLabel = isPreview && !matchedHistory ? 'Aguardando confirmação' : formatDeliveryStatus(item.delivery_status);
            const channelLabel = inferChannelLabel(item.channel, lead);

            return (
              <div key={item.id} className={`chat-row ${isHighlighted ? 'chat-row-highlight' : ''} ${isInbound ? 'chat-row-inbound' : ''}`}>
                <div className={`chat-bubble ${isPreview ? 'chat-bubble-preview' : ''} ${isInbound ? 'chat-bubble-inbound' : ''}`}>
                  <span className="chat-bubble-label">{isPreview && !matchedHistory ? 'Prévia do envio' : senderLabel}</span>
                  <p>{item.message_text}</p>
                  <div className="chat-bubble-meta">
                    <span>
                      {channelLabel} · {statusLabel}
                    </span>
                    <time dateTime={item.sent_at}>{formatDateTime(item.sent_at)}</time>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="chat-modal-footer">
          <p className="chat-disclaimer">
            Esta conversa é um mock controlado para avaliação. O registro é real no histórico de envios simulados.
          </p>
          <div className="chat-modal-actions">
            <button type="button" className="ghost" onClick={onClose} disabled={busy}>
              Fechar
            </button>
            {!matchedHistory && (
              <button type="button" onClick={() => onConfirm(message)} disabled={busy}>
                <Send aria-hidden />
                {busy ? 'Confirmando envio...' : 'Confirmar envio no mock'}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
