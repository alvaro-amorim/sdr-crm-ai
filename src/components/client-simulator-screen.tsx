import { ArrowLeft, Bot, RefreshCcw, Send, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Campaign, ConversationMessage, ConversationThread, Lead } from '../types/domain';
import { formatDateTime } from '../utils/crm-ui';
import { getErrorMessage } from '../utils/error-messages';

type SimulatorThread = ConversationThread & {
  leads?: Lead;
  campaigns?: Campaign;
};

type SimulatorPayload = {
  thread: SimulatorThread;
  messages: ConversationMessage[];
  generated_model?: string;
  used_fallback?: boolean;
  pending_message?: {
    id: string;
    scheduled_for: string;
    status: 'pending' | 'sent' | 'canceled';
  } | null;
  processed_scheduled_messages?: number;
};

function getTokenFromUrl() {
  return new URLSearchParams(window.location.search).get('token') ?? '';
}

function getChannelLabel(channel: string | null | undefined) {
  switch (channel) {
    case 'whatsapp':
      return 'WhatsApp simulado';
    case 'linkedin':
      return 'LinkedIn simulado';
    default:
      return 'E-mail simulado';
  }
}

function getFriendlySimulatorError(error: unknown) {
  return getErrorMessage(error, 'simulator');
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function ClientSimulatorScreen() {
  const token = useMemo(getTokenFromUrl, []);
  const [payload, setPayload] = useState<SimulatorPayload | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applyPayload(data: SimulatorPayload, humanized = false) {
    if (humanized) {
      await wait(randomBetween(20_000, 45_000));
      setTyping(true);
      await wait(randomBetween(3_000, 6_000));
      setTyping(false);
    }

    setPayload(data);
  }

  async function loadThread(options: { silent?: boolean } = {}) {
    if (!supabase || !token) return;
    if (!options.silent) setBusy(true);
    setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('simulate-client-chat', {
        body: { token },
      });
      if (functionError) throw functionError;
      if (!data?.success) throw new Error(data?.error ?? 'Falha ao carregar conversa.');
      const processedScheduledMessages = Number(data.data?.processed_scheduled_messages ?? 0);
      await applyPayload(data.data, options.silent && processedScheduledMessages > 0);
    } catch (loadError) {
      if (!options.silent) setError(getFriendlySimulatorError(loadError));
    } finally {
      if (!options.silent) setBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !reply.trim()) return;

    const trimmedReply = reply.trim();
    const optimisticMessage: ConversationMessage | null = payload
      ? {
          id: `optimistic-${Date.now()}`,
          workspace_id: payload.thread.workspace_id,
          thread_id: payload.thread.id,
          lead_id: payload.thread.lead_id,
          campaign_id: payload.thread.campaign_id,
          direction: 'inbound',
          sender_type: 'client',
          sender_name: payload.thread.leads?.name ?? 'Cliente',
          message_text: trimmedReply,
          model_name: null,
          prompt_purpose: null,
          sentiment_tag: null,
          intent_tag: null,
          generated_by: 'user',
          token_usage: null,
          created_at: new Date().toISOString(),
        }
      : null;

    if (optimisticMessage) {
      setPayload((current) => (current ? { ...current, messages: [...current.messages, optimisticMessage] } : current));
    }

    setReply('');
    setBusy(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('simulate-client-chat', {
        body: { token, message: trimmedReply },
      });
      if (functionError) throw functionError;
      if (!data?.success) throw new Error(data?.error ?? 'Falha ao gerar resposta.');
      await applyPayload(data.data, true);
    } catch (replyError) {
      setTyping(false);
      setError(getFriendlySimulatorError(replyError));
      if (optimisticMessage) {
        setPayload((current) =>
          current
            ? {
                ...current,
                messages: current.messages.filter((message) => message.id !== optimisticMessage.id),
              }
            : current,
        );
      }
      setReply(trimmedReply);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadThread();
  }, []);

  useEffect(() => {
    if (!token) return;
    const intervalId = window.setInterval(() => {
      if (!busy) void loadThread({ silent: true });
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [busy, token]);

  if (!token) {
    return (
      <main className="client-simulator-screen">
        <section className="client-simulator-empty">
          <Bot aria-hidden />
          <h1>Link de simulação inválido</h1>
          <p>Abra o simulador pelo atalho da tela Mensagens IA.</p>
        </section>
      </main>
    );
  }

  const lead = payload?.thread.leads;
  const campaign = payload?.thread.campaigns;

  return (
    <main className="client-simulator-screen">
      <section className="client-simulator-shell">
        <header className="client-simulator-header">
          <div>
            <span className="section-kicker">Simulador do cliente</span>
            <h1>{lead ? `Conversa com ${lead.name}` : 'Carregando conversa'}</h1>
            <p>
              Responda como cliente em uma janela separada. A próxima mensagem é gerada pela IA e gravada no histórico da
              operação.
            </p>
          </div>
          <button type="button" className="ghost compact" onClick={() => window.close()}>
            <ArrowLeft aria-hidden />
            Fechar janela
          </button>
        </header>

        {error && (
          <div className="status error-box">
            <strong>{error}</strong>
            <button type="button" className="ghost compact" onClick={() => void loadThread()}>
              <RefreshCcw aria-hidden />
              Tentar novamente
            </button>
          </div>
        )}

        {payload?.pending_message?.status === 'pending' && (
          <div className="status">
            <strong>Resposta pronta para envio</strong>
            <span>Será disparada automaticamente em {formatDateTime(payload.pending_message.scheduled_for)} no horário de São Paulo.</span>
          </div>
        )}

        <div className="client-simulator-context">
          <article>
            <strong>{lead?.company ?? 'Empresa'}</strong>
            <span>{lead?.job_title ?? 'Cargo não informado'}</span>
          </article>
          <article>
            <strong>{campaign?.name ?? 'Campanha'}</strong>
            <span>{payload ? getChannelLabel(payload.thread.channel) : 'Canal simulado'}</span>
          </article>
          <article>
            <strong>{payload?.messages.length ?? 0} mensagens</strong>
            <span>{payload?.generated_model ? `Último modelo: ${payload.generated_model}` : 'Histórico persistido'}</span>
          </article>
        </div>

        <section className="client-chat-window" aria-live="polite">
          {busy && !payload ? (
            <div className="client-simulator-loading">
              <RefreshCcw className="spin" aria-hidden />
              <span>Carregando conversa...</span>
            </div>
          ) : (
            payload?.messages.map((message) => {
              const inbound = message.direction === 'inbound';
              return (
                <article key={message.id} className={`client-chat-message ${inbound ? 'client-chat-message-inbound' : ''}`}>
                  <div className="client-chat-avatar">{inbound ? <UserRound aria-hidden /> : <Bot aria-hidden />}</div>
                  <div className="client-chat-bubble">
                    <div className="client-chat-meta">
                      <strong>{message.sender_name}</strong>
                      <time dateTime={message.created_at}>{formatDateTime(message.created_at)}</time>
                    </div>
                    <p>{message.message_text}</p>
                  </div>
                </article>
              );
            })
          )}
          {typing && (
            <article className="client-chat-message">
              <div className="client-chat-avatar">
                <Bot aria-hidden />
              </div>
              <div className="client-chat-bubble client-chat-typing">
                <strong>SDR Expert está digitando...</strong>
              </div>
            </article>
          )}
        </section>

        <form className="client-reply-form" onSubmit={submit}>
          <label htmlFor="clientReply">
            Responder como cliente
            <textarea
              id="clientReply"
              name="clientReply"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Exemplo: Tenho interesse, mas preciso entender prazo de implantação e esforço do meu time."
              maxLength={1200}
              disabled={busy}
              required
            />
          </label>
          <button type="submit" disabled={busy || reply.trim().length === 0}>
            <Send aria-hidden />
            {busy ? 'Aguardando IA...' : 'Enviar resposta'}
          </button>
        </form>
      </section>
    </main>
  );
}
