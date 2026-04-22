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
  lead_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
});

type GeneratedPayload = {
  messages?: Array<{ text?: string } | string>;
};

type AiAttempt = {
  model: string;
  temperature: number;
  timeoutMs: number;
};

const aiFallbackChain: AiAttempt[] = [
  { model: 'gpt-4o-mini', temperature: 0.7, timeoutMs: 10000 },
  { model: 'gpt-4o', temperature: 0.6, timeoutMs: 12000 },
  { model: 'gpt-4.1-mini', temperature: 0.5, timeoutMs: 12000 },
];

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizeMessages(payload: GeneratedPayload): string[] {
  const rawMessages = payload.messages ?? [];
  return rawMessages
    .map((item) => (typeof item === "string" ? item : item.text ?? ''))
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .slice(0, 3);
}

function isRetryableStatus(status: number): boolean {
  return status !== 401 && status !== 403;
}

async function callOpenAiWithFallback(openAiKey: string, prompt: string): Promise<{ messages: string[]; model: string }> {
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
            { role: 'system', content: 'Retorne somente JSON válido no formato {"messages":[{"text":"..."}]}.' },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        lastError = `Modelo ${attempt.model} retornou HTTP ${response.status}.`;
        if (isRetryableStatus(response.status)) {
          continue;
        }
        throw new Error(lastError);
      }

      const completion = await response.json();
      const content = completion.choices?.[0]?.message?.content;
      const generated = sanitizeMessages(JSON.parse(content ?? '{}'));

      if (generated.length >= 2) {
        return { messages: generated, model: attempt.model };
      }

      lastError = `Modelo ${attempt.model} retornou resposta incompleta.`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      continue;
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
    return json(500, { success: false, error: 'Serviço de geração não configurado.' });
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

  const {
    data: userData,
    error: userError,
  } = await userClient.auth.getUser(token);

  const userId = userData?.user?.id;
  if (userError || !userId) {
    return json(401, { success: false, error: 'Sessão inválida.' });
  }

  const { workspace_id, lead_id, campaign_id } = parsed.data;

  const { data: membership } = await userClient
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspace_id)
    .eq('user_id', userId)
    .single();

  if (!membership) {
    return json(403, { success: false, error: 'Acesso ao workspace negado.' });
  }

  const [{ data: lead }, { data: campaign }, { data: customValues }] = await Promise.all([
    userClient.from('leads').select('*').eq('workspace_id', workspace_id).eq('id', lead_id).single(),
    userClient.from('campaigns').select('*').eq('workspace_id', workspace_id).eq('id', campaign_id).eq('is_active', true).single(),
    userClient
      .from('lead_custom_field_values')
      .select('value_text, workspace_custom_fields(name, field_key)')
      .eq('workspace_id', workspace_id)
      .eq('lead_id', lead_id),
  ]);

  if (!lead || !campaign) {
    return json(404, { success: false, error: 'Lead ou campanha não encontrados.' });
  }

  const leadContext = {
    nome: lead.name,
    email: lead.email,
    telefone: lead.phone,
    empresa: lead.company,
    cargo: lead.job_title,
    origem: lead.lead_source,
    observacoes: lead.notes,
    campos_personalizados: customValues ?? [],
  };

  const prompt = [
    'Você é um especialista em pré-vendas B2B.',
    'Gere exatamente 3 mensagens curtas, profissionais e personalizadas para abordagem SDR.',
    'Não invente dados não fornecidos. Não use markdown. Retorne JSON válido no formato {"messages":[{"text":"..."}]}.',
    `Contexto da campanha: ${campaign.context_text}`,
    `Instrução da campanha: ${campaign.generation_prompt}`,
    `Dados do lead: ${JSON.stringify(leadContext)}`,
  ].join('\n\n');

  try {
    const generated = await callOpenAiWithFallback(openAiKey, prompt);

    const rows = generated.messages.map((messageText, index) => ({
      workspace_id,
      lead_id,
      campaign_id,
      variation_index: index + 1,
      message_text: messageText,
      generation_status: 'generated',
      generated_by_user_id: userId,
    }));

    const { data: savedMessages, error: insertError } = await userClient.from('generated_messages').insert(rows).select();
    if (insertError) {
      return json(500, { success: false, error: 'Falha ao salvar mensagens geradas.' });
    }

    return json(200, { success: true, data: { messages: savedMessages, model: generated.model } });
  } catch (_error) {
    return json(502, { success: false, error: 'Falha segura ao gerar mensagens. Tente novamente.' });
  }
});
