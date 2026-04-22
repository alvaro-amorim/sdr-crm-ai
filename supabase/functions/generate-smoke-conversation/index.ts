import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-sdr-auth-token, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const inputSchema = z.object({
  workspace_id: z.string().uuid(),
  wave: z.union([z.literal(1), z.literal(2)]),
  scenario: z.string().min(3).max(120),
  scenario_profile: z.object({
    key: z.string().min(3).max(80),
    label: z.string().min(3).max(120),
    description: z.string().min(10).max(1200),
    resultStageName: z.string().min(3).max(120),
    threadStatus: z.enum(['open', 'positive', 'neutral', 'negative', 'meeting_scheduled', 'closed']),
    threadSentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
    sequence: z.array(
      z.object({
        direction: z.enum(['outbound', 'inbound']),
        promptPurpose: z.string().nullable().optional(),
        intentTag: z.string().min(3).max(80),
        guidance: z.string().min(10).max(800),
        expectedSentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).optional(),
      }),
    ).min(1).max(6),
  }),
  lead: z.record(z.unknown()),
  campaign: z.record(z.unknown()),
});

type AiAttempt = {
  model: string;
  temperature: number;
  timeoutMs: number;
};

type ConversationMessage = {
  direction: 'outbound' | 'inbound';
  sender_name: string;
  message_text: string;
  sentiment_tag: 'positive' | 'neutral' | 'negative' | 'mixed';
  intent_tag: string;
};

const aiFallbackChain: AiAttempt[] = [
  { model: 'gpt-4o-mini', temperature: 0.7, timeoutMs: 12000 },
  { model: 'gpt-4o', temperature: 0.6, timeoutMs: 14000 },
  { model: 'gpt-4.1-mini', temperature: 0.5, timeoutMs: 14000 },
];

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseConversation(
  content: string | null | undefined,
  scenarioProfile: z.infer<typeof inputSchema>['scenario_profile'],
): ConversationMessage[] {
  const parsed = JSON.parse(content ?? '{}');
  const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
  const normalized = messages
    .map((message, index) => {
      const direction = scenarioProfile.sequence[index]?.direction ?? (message.direction === 'inbound' || message.direction === 'outbound' ? message.direction : 'outbound');
      const sentiment = ['positive', 'neutral', 'negative', 'mixed'].includes(message.sentiment_tag) ? message.sentiment_tag : 'neutral';

      return {
        direction,
        sender_name: direction === 'outbound' ? 'SDR Expert' : String(message.sender_name ?? 'Cliente').trim(),
        message_text: String(message.message_text ?? '').trim(),
        sentiment_tag: sentiment,
        intent_tag: String(message.intent_tag ?? 'follow_up').trim().slice(0, 80),
      };
    })
    .filter((message) => message.message_text.length > 0)
    .slice(0, scenarioProfile.sequence.length);

  if (normalized.length !== scenarioProfile.sequence.length) {
    throw new Error('A IA retornou quantidade de mensagens diferente do cenário.');
  }

  scenarioProfile.sequence.forEach((step, index) => {
    if (normalized[index]?.direction !== step.direction) {
      throw new Error('A IA retornou uma sequência inválida para o cenário do smoke.');
    }
  });

  return normalized;
}

function buildConversationPrompt(input: z.infer<typeof inputSchema>) {
  const targetMessages = input.scenario_profile.sequence.length;
  const sequenceInstructions = input.scenario_profile.sequence
    .map((step, index) => {
      const purposePart = step.direction === 'outbound' && step.promptPurpose ? ` / prompt_purpose=${step.promptPurpose}` : '';
      const sentimentPart = step.expectedSentiment ? ` / sentimento=${step.expectedSentiment}` : '';
      return `${index + 1}. ${step.direction}${purposePart}${sentimentPart}: ${step.guidance}`;
    })
    .join('\n');

  return [
    'Você vai gerar uma conversa B2B realista para um CRM SDR brasileiro.',
    'A conversa precisa parecer uma operação real em andamento, não um exemplo genérico.',
    'Retorne somente JSON válido. Não use markdown.',
    `Gere exatamente ${targetMessages} mensagens seguindo a sequência obrigatória de direções abaixo.`,
    'Use português do Brasil com acentuação correta, tom profissional, humano e sem exagero.',
    'Não invente dados sensíveis. Use apenas os dados do lead e campanha fornecidos.',
    'Cada mensagem deve ter no máximo 420 caracteres.',
    'Formato obrigatório: {"messages":[{"direction":"outbound|inbound","sender_name":"...","message_text":"...","sentiment_tag":"positive|neutral|negative|mixed","intent_tag":"..."}]}',
    `Onda: ${input.wave}`,
    `Cenário alvo: ${input.scenario}`,
    `Descrição operacional: ${input.scenario_profile.description}`,
    `Resultado esperado: status=${input.scenario_profile.threadStatus}, sentimento=${input.scenario_profile.threadSentiment}, etapa_final=${input.scenario_profile.resultStageName}`,
    'Sequência obrigatória:',
    sequenceInstructions,
    'Não altere a ordem das mensagens nem troque outbound por inbound.',
    `Lead: ${JSON.stringify(input.lead)}`,
    `Campanha: ${JSON.stringify(input.campaign)}`,
  ].join('\n\n');
}

async function callOpenAiWithFallback(
  openAiKey: string,
  prompt: string,
  scenarioProfile: z.infer<typeof inputSchema>['scenario_profile'],
) {
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
                'Retorne somente JSON válido com conversas comerciais realistas. Todos os textos devem estar em português do Brasil com acentuação correta.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        lastError = `Modelo ${attempt.model} retornou HTTP ${response.status}.`;
        if (response.status !== 401 && response.status !== 403) continue;
        throw new Error(lastError);
      }

      const completion = await response.json();
      return {
        messages: parseConversation(completion.choices?.[0]?.message?.content, scenarioProfile),
        model: attempt.model,
        usage: completion.usage ?? null,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(lastError);
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
    return json(500, { success: false, error: 'Serviço de smoke não configurado.' });
  }

  const authorization = request.headers.get('Authorization') ?? (request.headers.get('x-sdr-auth-token') ? `Bearer ${request.headers.get('x-sdr-auth-token')}` : null);
  if (!authorization) {
    return json(401, { success: false, error: 'Autenticação obrigatória.' });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json(400, { success: false, error: 'Payload inválido.' });
  }

  const token = authorization.replace('Bearer ', '');
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) {
    return json(401, { success: false, error: 'Sessão inválida.' });
  }

  const { data: membership } = await userClient
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', parsed.data.workspace_id)
    .eq('user_id', userId)
    .single();

  if (!membership) {
    return json(403, { success: false, error: 'Acesso ao workspace negado.' });
  }

  try {
    const prompt = buildConversationPrompt(parsed.data);
    const generated = await callOpenAiWithFallback(openAiKey, prompt, parsed.data.scenario_profile);

    return json(200, { success: true, data: generated });
  } catch (_error) {
    return json(502, { success: false, error: 'Falha segura ao gerar conversa do smoke.' });
  }
});
