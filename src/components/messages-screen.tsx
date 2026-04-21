import { Activity, Building2, Clock3, MessageSquareText, Send, Sparkles, Workflow, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { moveLead } from '../services/crm';
import type { Campaign, CrmData, GeneratedMessage, Lead, PipelineStage, SentMessageEvent } from '../types/domain';
import { findStageByName, formatDateTime, getLeadChannel, getLeadMetaLine } from '../utils/crm-ui';

export function MessagesScreen({
  data,
  user,
  onReload,
  setError,
  setNotice,
}: {
  data: CrmData;
  user: User;
  onReload: () => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
}) {
  const [leadId, setLeadId] = useState(data.leads[0]?.id ?? '');
  const [campaignId, setCampaignId] = useState(data.campaigns.find((campaign) => campaign.is_active)?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState<GeneratedMessage | null>(null);
  const [simulationBusy, setSimulationBusy] = useState(false);
  const activeCampaigns = data.campaigns.filter((campaign) => campaign.is_active);
  const selectedLead = data.leads.find((lead) => lead.id === leadId) ?? null;
  const selectedCampaign = data.campaigns.find((campaign) => campaign.id === campaignId) ?? null;
  const selectedStage = selectedLead ? data.stages.find((stage) => stage.id === selectedLead.current_stage_id) ?? null : null;
  const targetStage = findStageByName(data.stages, 'Tentando Contato');
  const leadMessages = data.generatedMessages
    .filter((message) => message.lead_id === leadId && (!campaignId || message.campaign_id === campaignId))
    .sort((left, right) => left.variation_index - right.variation_index);
  const leadTimeline = data.sentMessageEvents
    .filter((event) => event.lead_id === leadId)
    .sort((left, right) => new Date(left.sent_at).getTime() - new Date(right.sent_at).getTime());

  useEffect(() => {
    if (leadId && data.leads.some((lead) => lead.id === leadId)) return;
    setLeadId(data.leads[0]?.id ?? '');
  }, [data.leads, leadId]);

  useEffect(() => {
    if (campaignId && activeCampaigns.some((campaign) => campaign.id === campaignId)) return;
    setCampaignId(activeCampaigns[0]?.id ?? '');
  }, [activeCampaigns, campaignId]);

  async function generateMessages() {
    if (!supabase || !leadId || !campaignId) {
      setError('Selecione lead e campanha ativa.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: functionError } = await supabase.functions.invoke('generate-lead-messages', {
        body: { workspace_id: data.workspace.id, lead_id: leadId, campaign_id: campaignId },
      });
      if (functionError) throw functionError;
      setNotice('Mensagens geradas e salvas.');
      await onReload();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Falha inesperada ao gerar mensagens.');
    } finally {
      setBusy(false);
    }
  }

  async function simulateSend(message: GeneratedMessage) {
    if (!supabase) return;
    if (!targetStage) {
      setError('Etapa Tentando Contato não encontrada.');
      return;
    }

    try {
      setSimulationBusy(true);
      const { error: eventError } = await supabase.from('sent_message_events').insert({
        workspace_id: data.workspace.id,
        lead_id: message.lead_id,
        campaign_id: message.campaign_id,
        generated_message_id: message.id,
        message_text: message.message_text,
        sent_by_user_id: user.id,
        is_simulated: true,
      });
      if (eventError) throw eventError;

      const { error: messageError } = await supabase
        .from('generated_messages')
        .update({ generation_status: 'sent' })
        .eq('workspace_id', data.workspace.id)
        .eq('id', message.id);
      if (messageError) throw messageError;

      await moveLead(supabase, data.workspace.id, message.lead_id, targetStage.id);
      setSimulationMessage(null);
      setNotice('Simulação registrada no chat. Lead movido para Tentando Contato.');
      await onReload();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Falha inesperada ao simular envio.');
    } finally {
      setSimulationBusy(false);
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
          <label>
            Lead
            <select name="messageLead" value={leadId} onChange={(event) => setLeadId(event.target.value)}>
              {data.leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name}
                </option>
              ))}
            </select>
          </label>
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
          <button type="button" onClick={generateMessages} disabled={busy || data.leads.length === 0 || activeCampaigns.length === 0}>
            <Sparkles aria-hidden />
            {busy ? 'Gerando mensagens...' : 'Gerar mensagens'}
          </button>
        </div>

        <div className="message-overview-grid">
          <article className="overview-card">
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

          <article className="overview-card">
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

          <article className="overview-card overview-card-accent">
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

      <section className="message-grid">
        {leadMessages.length === 0 ? (
          <div className="panel empty-panel">
            <Sparkles aria-hidden />
            <div>
              <h2>Nenhuma mensagem pronta para este contexto</h2>
              <p className="empty">Selecione um lead, uma campanha ativa e gere as variações para abrir a simulação de chat.</p>
            </div>
          </div>
        ) : (
          leadMessages.map((message) => (
            <article className="message-card" key={message.id}>
              <div className="message-card-header">
                <span>Variação {message.variation_index}</span>
                <span className={`message-status message-status-${message.generation_status}`}>
                  {message.generation_status === 'sent' ? 'Enviada no mock' : 'Pronta para envio'}
                </span>
              </div>
              <p>{message.message_text}</p>
              <div className="message-card-footer">
                <div className="message-card-meta">
                  <Clock3 aria-hidden />
                  <span>Gerada em {formatDateTime(message.created_at)}</span>
                </div>
                <button type="button" onClick={() => setSimulationMessage(message)}>
                  <MessageSquareText aria-hidden />
                  {message.generation_status === 'sent' ? 'Ver no chat' : 'Simular no chat'}
                </button>
              </div>
            </article>
          ))
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
  const threadItems = matchedHistory
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
          sent_at: new Date().toISOString(),
        },
      ];

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        className="chat-modal"
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
            <span>Canal: {getLeadChannel(lead)}</span>
          </article>
        </div>

        <div className="chat-thread">
          {threadItems.map((item) => {
            const isPreview = item.id === `preview-${message.id}`;
            const isHighlighted = item.generated_message_id === message.id;

            return (
              <div key={item.id} className={`chat-row ${isHighlighted ? 'chat-row-highlight' : ''}`}>
                <div className={`chat-bubble ${isPreview ? 'chat-bubble-preview' : ''}`}>
                  <span className="chat-bubble-label">{isPreview && !matchedHistory ? 'Prévia do envio' : 'SDR Expert'}</span>
                  <p>{item.message_text}</p>
                  <div className="chat-bubble-meta">
                    <span>{isPreview && !matchedHistory ? 'Aguardando confirmação' : 'Enviado simulado'}</span>
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
