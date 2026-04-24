import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { getDeterministicConversationOutcome, mergeConversationVerdict, resolveNextOutboundPurpose } from './conversation-verdict.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-sdr-auth-token, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const inputSchema = z.object({
  token: z.string().min(20).max(160),
  message: z.string().trim().min(1).max(1200).optional(),
});

type AiAttempt = {
  model: string;
  temperature: number;
  timeoutMs: number;
};

type AiCompletionVerdict = {
  message_text: string;
  sentiment_tag: 'positive' | 'neutral' | 'negative' | 'mixed';
  intent_tag: string;
  thread_status: 'open' | 'positive' | 'neutral' | 'negative' | 'meeting_scheduled' | 'closed';
  lead_stage_action: 'keep_current' | 'desqualificado' | 'qualificado' | 'reuniao_agendada' | 'tentando_contato' | 'conexao_iniciada';
  should_close: boolean;
  model: string;
  usage: unknown;
};

type FallbackReason = 'openai_not_configured' | 'openai_call_failed';

type BusinessWindow = {
  isBusinessHours: boolean;
  nextOpeningIso: string;
};

const aiFallbackChain: AiAttempt[] = [
  { model: 'gpt-4o-mini', temperature: 0.55, timeoutMs: 12000 },
  { model: 'gpt-4o', temperature: 0.5, timeoutMs: 14000 },
  { model: 'gpt-4.1-mini', temperature: 0.45, timeoutMs: 14000 },
];

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value);
  return toHex(await crypto.subtle.digest('SHA-256', encoded));
}

function parseTime(value: unknown, fallback: string) {
  const text = String(value ?? fallback);
  const [hour = '0', minute = '0'] = text.split(':');
  return {
    hour: Number(hour),
    minute: Number(minute),
  };
}

function getSaoPauloParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(byType.get('year')),
    month: Number(byType.get('month')),
    day: Number(byType.get('day')),
    hour: Number(byType.get('hour')),
    minute: Number(byType.get('minute')),
  };
}

function saoPauloLocalToUtcIso(parts: { year: number; month: number; day: number; hour: number; minute: number }) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour + 3, parts.minute, 0)).toISOString();
}

function addSaoPauloDays(parts: { year: number; month: number; day: number; hour: number; minute: number }, days: number) {
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  const shifted = getSaoPauloParts(utc);
  return { ...shifted, hour: parts.hour, minute: parts.minute };
}

function resolveBusinessWindow(campaign: Record<string, unknown>): BusinessWindow {
  const mode = campaign.ai_response_mode;
  if (mode !== 'business_hours') {
    return { isBusinessHours: true, nextOpeningIso: new Date().toISOString() };
  }

  const start = parseTime(campaign.ai_response_window_start, '09:00');
  const end = parseTime(campaign.ai_response_window_end, '18:00');
  const now = getSaoPauloParts();
  const nowMinutes = now.hour * 60 + now.minute;
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  const wrapsMidnight = startMinutes > endMinutes;
  const isBusinessHours = wrapsMidnight
    ? nowMinutes >= startMinutes || nowMinutes < endMinutes
    : nowMinutes >= startMinutes && nowMinutes < endMinutes;

  if (isBusinessHours) {
    return { isBusinessHours: true, nextOpeningIso: new Date().toISOString() };
  }

  const openingToday = { ...now, hour: start.hour, minute: start.minute };
  const nextOpening =
    !wrapsMidnight && nowMinutes < startMinutes ? openingToday : addSaoPauloDays(openingToday, nowMinutes < startMinutes ? 0 : 1);

  return {
    isBusinessHours: false,
    nextOpeningIso: saoPauloLocalToUtcIso(nextOpening),
  };
}

function formatSaoPauloTime(value: unknown, fallback: string) {
  const { hour, minute } = parseTime(value, fallback);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function isRetryableStatus(status: number): boolean {
  return status !== 401 && status !== 403;
}

function parseAiJson(content: string | null) {
  const parsed = JSON.parse(content ?? '{}');
  const messageText = String(parsed.message_text ?? '').trim();
  const sentimentTag = String(parsed.sentiment_tag ?? 'neutral').trim().toLowerCase();
  const intentTag = String(parsed.intent_tag ?? 'follow_up').trim().toLowerCase();
  const threadStatus = String(parsed.thread_status ?? 'neutral').trim().toLowerCase();
  const leadStageAction = String(parsed.lead_stage_action ?? 'keep_current').trim().toLowerCase();

  if (!messageText) {
    throw new Error('Resposta vazia.');
  }

  return {
    message_text: messageText.slice(0, 2200),
    sentiment_tag: ['positive', 'neutral', 'negative', 'mixed'].includes(sentimentTag) ? sentimentTag : 'neutral',
    intent_tag: intentTag.slice(0, 80),
    thread_status: ['open', 'positive', 'neutral', 'negative', 'meeting_scheduled', 'closed'].includes(threadStatus) ? threadStatus : 'neutral',
    lead_stage_action: ['keep_current', 'desqualificado', 'qualificado', 'reuniao_agendada', 'tentando_contato', 'conexao_iniciada'].includes(leadStageAction)
      ? leadStageAction
      : 'keep_current',
    should_close: Boolean(parsed.should_close),
  };
}

function buildFallbackReply(clientMessage: string) {
  const deterministic = getDeterministicConversationOutcome(clientMessage);

  if (deterministic.thread_status === 'meeting_scheduled') {
    return {
      message_text:
        'Perfeito, vamos avançar com o agendamento. Pode me confirmar dois horários possíveis para esta semana que eu te envio o convite?',
      sentiment_tag: deterministic.sentiment_tag ?? 'positive',
      intent_tag: deterministic.intent_tag ?? 'meeting_confirmation',
      thread_status: deterministic.thread_status ?? 'meeting_scheduled',
      lead_stage_action: deterministic.lead_stage_action ?? 'reuniao_agendada',
      should_close: deterministic.should_close ?? false,
    } satisfies Omit<AiCompletionVerdict, 'model' | 'usage'>;
  }

  if (deterministic.thread_status === 'negative') {
    return {
      message_text:
        'Entendido, obrigado pela transparência. Se o cenário mudar no futuro, fico à disposição para retomar com você no momento certo.',
      sentiment_tag: deterministic.sentiment_tag ?? 'negative',
      intent_tag: deterministic.intent_tag ?? 'closing_note',
      thread_status: deterministic.thread_status ?? 'negative',
      lead_stage_action: deterministic.lead_stage_action ?? 'desqualificado',
      should_close: deterministic.should_close ?? true,
    } satisfies Omit<AiCompletionVerdict, 'model' | 'usage'>;
  }

  return {
    message_text:
      'Obrigado pelo retorno. Para te responder com precisão, me confirma o principal objetivo e o prazo que vocês querem atingir com essa frente?',
    sentiment_tag: 'neutral',
    intent_tag: 'qualification_follow_up',
    thread_status: 'open',
    lead_stage_action: 'keep_current',
    should_close: false,
  } satisfies Omit<AiCompletionVerdict, 'model' | 'usage'>;
}

function fallbackVerdict(clientMessage: string, reason: FallbackReason): AiCompletionVerdict {
  return {
    ...buildFallbackReply(clientMessage),
    model: reason === 'openai_not_configured' ? 'fallback-rule-engine:missing-openai-key' : 'fallback-rule-engine:openai-recovery',
    usage: null,
  };
}

async function callOpenAiWithFallback(openAiKey: string, prompt: string): Promise<AiCompletionVerdict> {
  let lastError = 'Falha desconhecida no provedor de IA.';

  for (const attempt of aiFallbackChain) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), attempt.timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: attempt.model,
          temperature: attempt.temperature,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Voce e um SDR senior B2B. Retorne somente JSON valido no formato {"message_text":"...","sentiment_tag":"positive|neutral|negative|mixed","intent_tag":"...","thread_status":"open|positive|neutral|negative|meeting_scheduled|closed","lead_stage_action":"keep_current|desqualificado|qualificado|reuniao_agendada|tentando_contato|conexao_iniciada","should_close":true|false}.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        lastError = `Modelo ${attempt.model} retornou HTTP ${response.status}.`;
        if (isRetryableStatus(response.status)) continue;
        throw new Error(lastError);
      }

      const completion = await response.json();
      const content = completion.choices?.[0]?.message?.content;
      const usage = completion.usage ?? null;
      return { ...parseAiJson(content), model: attempt.model, usage };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(lastError);
}

function buildPrompt({
  lead,
  campaign,
  messages,
  clientMessage,
  expectedPromptPurpose,
  outsideBusinessHours,
}: {
  lead: Record<string, unknown>;
  campaign: Record<string, unknown>;
  messages: Array<Record<string, unknown>>;
  clientMessage: string;
  expectedPromptPurpose: string;
  outsideBusinessHours?: boolean;
}) {
  const history = messages
    .map((message) => {
      const role = message.direction === 'inbound' ? 'Cliente' : 'SDR Expert';
      return `${role}: ${message.message_text}`;
    })
    .join('\n');

  return [
    'Continue uma conversa comercial realista em portugues do Brasil.',
    'A pessoa que esta respondendo no simulador esta agindo como cliente. Responda como SDR, mantendo contexto e proximo passo claro.',
    'Nao invente compromisso fechado se o cliente nao confirmou.',
    'Se houver objecao forte ou recusa, responda com encerramento cordial e sem insistir.',
    'Se houver interesse, avance para diagnostico, envio de material ou agendamento.',
    'Classifique a conversa com base principal na mensagem do cliente e no historico, nao no sentimento da sua propria resposta.',
    outsideBusinessHours
      ? 'A mensagem sera enviada somente quando o horario de atendimento em Sao Paulo iniciar. Comece reconhecendo que o cliente chamou fora do horario e retome com prioridade de forma natural, sem parecer resposta automatica.'
      : 'Responda como continuidade imediata da conversa.',
    `Tipo esperado da sua proxima mensagem: ${expectedPromptPurpose}.`,
    'Retorne JSON valido sem markdown.',
    `Lead: ${JSON.stringify(lead)}`,
    `Campanha: ${JSON.stringify(campaign)}`,
    `Historico:\n${history || 'Sem historico anterior.'}`,
    `Nova resposta do cliente: ${clientMessage}`,
    `Guardrails deterministas: ${JSON.stringify(getDeterministicConversationOutcome(clientMessage))}`,
  ].join('\n\n');
}

function buildOutsideHoursNotice({
  lead,
  campaign,
}: {
  lead: Record<string, unknown>;
  campaign: Record<string, unknown>;
}) {
  const firstName = String(lead?.name ?? 'Cliente').split(' ')[0] || 'Cliente';
  const start = formatSaoPauloTime(campaign.ai_response_window_start, '09:00');
  const end = formatSaoPauloTime(campaign.ai_response_window_end, '18:00');
  return `Recebi sua mensagem, ${firstName}. Nosso atendimento funciona das ${start} às ${end}, no horário de São Paulo. Já deixei seu retorno como prioridade e vou te responder assim que o atendimento iniciar.`;
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json(405, { success: false, error: 'Metodo nao permitido.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const openAiKey = Deno.env.get('OPENAI_API_KEY');

  if (!supabaseUrl || !publishableKey) {
    return json(500, { success: false, error: 'Servico de simulacao nao configurado.' });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json(400, { success: false, error: 'Payload invalido.' });
  }

  const publicClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tokenHash = await sha256(parsed.data.token);
  const { data: context, error: contextError } = await publicClient.rpc('get_simulation_context', {
    target_token_hash: tokenHash,
  });

  if (contextError || !context?.thread) {
    return json(403, { success: false, error: 'Link de simulacao invalido ou expirado.' });
  }

  const thread = context.thread;
  const messages = Array.isArray(context.messages) ? context.messages : [];

  if (!parsed.data.message) {
    return json(200, {
      success: true,
      data: {
        thread,
        messages,
        pending_message: context.pending_message ?? null,
        processed_scheduled_messages: context.processed_scheduled_messages ?? 0,
      },
    });
  }

  const businessWindow = resolveBusinessWindow(thread.campaigns ?? {});

  const prompt = buildPrompt({
    lead: thread.leads,
    campaign: thread.campaigns,
    messages,
    clientMessage: parsed.data.message,
    expectedPromptPurpose: resolveNextOutboundPurpose({
      history: [
        ...messages,
        {
          direction: 'inbound',
          sentiment_tag: getDeterministicConversationOutcome(parsed.data.message).sentiment_tag ?? 'neutral',
        },
      ],
      threadStatus: getDeterministicConversationOutcome(parsed.data.message).thread_status ?? thread.status,
    }),
    outsideBusinessHours: !businessWindow.isBusinessHours,
  });

  try {
    let completion: AiCompletionVerdict;
    if (openAiKey) {
      try {
        completion = await callOpenAiWithFallback(openAiKey, prompt);
      } catch (_openAiError) {
        completion = fallbackVerdict(parsed.data.message, 'openai_call_failed');
      }
    } else {
      completion = fallbackVerdict(parsed.data.message, 'openai_not_configured');
    }

    const generated = mergeConversationVerdict(parsed.data.message, completion);
    const promptPurpose = resolveNextOutboundPurpose({
      history: [...messages, { direction: 'inbound', sentiment_tag: generated.sentiment_tag }],
      threadStatus: generated.thread_status,
    });

    const rpcPayload = {
      target_token_hash: tokenHash,
      client_message: parsed.data.message,
      ai_model: generated.model,
      ai_usage: generated.usage,
      ai_sentiment: generated.sentiment_tag,
      ai_intent: generated.intent_tag,
      ai_prompt_purpose: promptPurpose,
      ai_thread_status: generated.thread_status,
      ai_stage_action: generated.lead_stage_action,
      ai_should_close: generated.should_close,
    };

    const { data: saved, error: saveError } = businessWindow.isBusinessHours
      ? await publicClient.rpc('append_simulation_exchange', {
          ...rpcPayload,
          ai_message: generated.message_text,
        })
      : await publicClient.rpc('append_scheduled_simulation_exchange', {
          ...rpcPayload,
          away_message: buildOutsideHoursNotice({ lead: thread.leads, campaign: thread.campaigns }),
          scheduled_ai_message: generated.message_text,
          scheduled_for: businessWindow.nextOpeningIso,
        });

    if (saveError || !saved?.messages) {
      return json(500, { success: false, error: 'Falha ao salvar resposta da IA.' });
    }

    return json(200, {
      success: true,
      data: {
        thread: { ...thread, ...(saved.thread ?? {}) },
        messages: saved.messages,
        generated_model: generated.model,
        used_fallback: generated.model.startsWith('fallback-rule-engine'),
        stage_decision: {
          action: generated.lead_stage_action,
          scheduled: !businessWindow.isBusinessHours,
        },
        pending_message: saved.pending_message ?? null,
        scheduled_for: saved.pending_message?.scheduled_for ?? null,
      },
    });
  } catch (_error) {
    return json(502, { success: false, error: 'Falha segura ao gerar resposta da IA. Tente novamente.' });
  }
});
