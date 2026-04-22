import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

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

function isRetryableStatus(status: number): boolean {
  return status !== 401 && status !== 403;
}

function parseAiJson(content: string | null) {
  const parsed = JSON.parse(content ?? '{}');
  const messageText = String(parsed.message_text ?? '').trim();
  const sentimentTag = String(parsed.sentiment_tag ?? 'neutral').trim().toLowerCase();
  const intentTag = String(parsed.intent_tag ?? 'follow_up').trim().toLowerCase();

  if (!messageText) {
    throw new Error('Resposta vazia.');
  }

  return {
    message_text: messageText.slice(0, 2200),
    sentiment_tag: ['positive', 'neutral', 'negative', 'mixed'].includes(sentimentTag) ? sentimentTag : 'neutral',
    intent_tag: intentTag.slice(0, 80),
  };
}

async function callOpenAiWithFallback(openAiKey: string, prompt: string) {
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
                'Você é um SDR sênior B2B. Retorne somente JSON válido no formato {"message_text":"...","sentiment_tag":"positive|neutral|negative|mixed","intent_tag":"..."}',
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
}: {
  lead: Record<string, unknown>;
  campaign: Record<string, unknown>;
  messages: Array<Record<string, unknown>>;
  clientMessage: string;
}) {
  const history = messages
    .map((message) => {
      const role = message.direction === 'inbound' ? 'Cliente' : 'SDR Expert';
      return `${role}: ${message.message_text}`;
    })
    .join('\n');

  return [
    'Continue uma conversa comercial realista em português do Brasil.',
    'A pessoa que está respondendo no simulador está agindo como cliente. Responda como SDR, mantendo contexto e próximo passo claro.',
    'Não invente compromisso fechado se o cliente não confirmou. Se houver objeção, reduza atrito. Se houver interesse, avance para diagnóstico ou envio de material.',
    'Retorne JSON válido sem markdown.',
    `Lead: ${JSON.stringify(lead)}`,
    `Campanha: ${JSON.stringify(campaign)}`,
    `Histórico:\n${history || 'Sem histórico anterior.'}`,
    `Nova resposta do cliente: ${clientMessage}`,
  ].join('\n\n');
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json(405, { success: false, error: 'Método não permitido.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const openAiKey = Deno.env.get('OPENAI_API_KEY');

  if (!supabaseUrl || !publishableKey || !openAiKey) {
    return json(500, { success: false, error: 'Serviço de simulação não configurado.' });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json(400, { success: false, error: 'Payload inválido.' });
  }

  const publicClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tokenHash = await sha256(parsed.data.token);
  const { data: context, error: contextError } = await publicClient.rpc('get_simulation_context', {
    target_token_hash: tokenHash,
  });

  if (contextError || !context?.thread) {
    return json(403, { success: false, error: 'Link de simulação inválido ou expirado.' });
  }

  const thread = context.thread;
  const messages = Array.isArray(context.messages) ? context.messages : [];

  if (!parsed.data.message) {
    return json(200, { success: true, data: { thread, messages } });
  }

  const prompt = buildPrompt({
    lead: thread.leads,
    campaign: thread.campaigns,
    messages,
    clientMessage: parsed.data.message,
  });

  try {
    const generated = await callOpenAiWithFallback(openAiKey, prompt);
    const { data: saved, error: saveError } = await publicClient.rpc('append_simulation_exchange', {
      target_token_hash: tokenHash,
      client_message: parsed.data.message,
      ai_message: generated.message_text,
      ai_model: generated.model,
      ai_usage: generated.usage,
      ai_sentiment: generated.sentiment_tag,
      ai_intent: generated.intent_tag,
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
      },
    });
  } catch (_error) {
    return json(502, { success: false, error: 'Falha segura ao gerar resposta da IA. Tente novamente.' });
  }
});
