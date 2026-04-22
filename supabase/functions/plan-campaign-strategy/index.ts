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
  name: z.string().trim().min(2).max(120),
  context_text: z.string().trim().min(5).max(4000),
  trigger_stage_id: z.string().uuid().nullable().optional(),
});

type AiAttempt = {
  model: string;
  temperature: number;
  timeoutMs: number;
};

type CampaignPlan = {
  objective_summary: string;
  icp_summary: string;
  pain_summary: string;
  tone_guidelines: string;
  cta_strategy: string;
  objection_handling: string;
  sequence_strategy: string;
  final_prompt: string;
  model: string;
};

const aiFallbackChain: AiAttempt[] = [
  { model: 'gpt-4o-mini', temperature: 0.45, timeoutMs: 12000 },
  { model: 'gpt-4o', temperature: 0.35, timeoutMs: 14000 },
  { model: 'gpt-4.1-mini', temperature: 0.35, timeoutMs: 14000 },
];

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isRetryableStatus(status: number): boolean {
  return status !== 401 && status !== 403;
}

function sanitizeField(value: unknown, max = 1200) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function parsePlan(content: string | null, model: string): CampaignPlan {
  const parsed = JSON.parse(content ?? '{}');

  return {
    objective_summary: sanitizeField(parsed.objective_summary, 400),
    icp_summary: sanitizeField(parsed.icp_summary, 500),
    pain_summary: sanitizeField(parsed.pain_summary, 600),
    tone_guidelines: sanitizeField(parsed.tone_guidelines, 500),
    cta_strategy: sanitizeField(parsed.cta_strategy, 400),
    objection_handling: sanitizeField(parsed.objection_handling, 600),
    sequence_strategy: sanitizeField(parsed.sequence_strategy, 600),
    final_prompt: sanitizeField(parsed.final_prompt, 2400),
    model,
  };
}

function assertPlan(plan: CampaignPlan) {
  if (
    !plan.objective_summary ||
    !plan.icp_summary ||
    !plan.pain_summary ||
    !plan.tone_guidelines ||
    !plan.cta_strategy ||
    !plan.objection_handling ||
    !plan.sequence_strategy ||
    !plan.final_prompt
  ) {
    throw new Error('Plano de campanha incompleto.');
  }

  return plan;
}

async function callOpenAiWithFallback(openAiKey: string, prompt: string): Promise<CampaignPlan> {
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
                'Você é um estrategista de outbound B2B. Retorne somente JSON válido no formato {"objective_summary":"...","icp_summary":"...","pain_summary":"...","tone_guidelines":"...","cta_strategy":"...","objection_handling":"...","sequence_strategy":"...","final_prompt":"..."} sem markdown.',
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
      return assertPlan(parsePlan(completion.choices?.[0]?.message?.content, attempt.model));
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
    return json(500, { success: false, error: 'Serviço de planejamento não configurado.' });
  }

  const authorization = request.headers.get('Authorization') ?? (request.headers.get('x-sdr-auth-token') ? `Bearer ${request.headers.get('x-sdr-auth-token')}` : null);
  if (!authorization) {
    return json(401, { success: false, error: 'Autenticação obrigatória.' });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json(400, { success: false, error: 'Payload inválido.' });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authorization.replace('Bearer ', '');
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) {
    return json(401, { success: false, error: 'Sessão inválida.' });
  }

  const { workspace_id, name, context_text, trigger_stage_id } = parsed.data;

  const { data: membership } = await userClient
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspace_id)
    .eq('user_id', userId)
    .single();

  if (!membership) {
    return json(403, { success: false, error: 'Acesso ao workspace negado.' });
  }

  const { data: triggerStage } = trigger_stage_id
    ? await userClient.from('pipeline_stages').select('name').eq('workspace_id', workspace_id).eq('id', trigger_stage_id).single()
    : { data: null };

  const prompt = [
    'Monte um plano estratégico de campanha SDR em português do Brasil.',
    'O usuário ainda não quer escrever prompt bruto.',
    'Você deve transformar o contexto em um plano operacional e em um prompt final utilizável por outra IA que vai gerar as mensagens.',
    'O prompt final deve orientar geração de mensagens curtas, profissionais, personalizadas e sem inventar dados.',
    'Inclua tom, CTA, objeções prováveis e a sequência esperada de abordagem.',
    `Nome da campanha: ${name}`,
    `Contexto comercial: ${context_text}`,
    `Etapa gatilho: ${triggerStage?.name ?? 'Sem gatilho definido'}`,
  ].join('\n\n');

  try {
    const plan = await callOpenAiWithFallback(openAiKey, prompt);
    return json(200, { success: true, data: plan });
  } catch (_error) {
    return json(502, { success: false, error: 'Falha segura ao planejar campanha. Tente novamente.' });
  }
});
