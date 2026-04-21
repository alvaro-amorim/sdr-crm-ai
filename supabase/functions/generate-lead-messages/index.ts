import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizeMessages(payload: GeneratedPayload): string[] {
  const rawMessages = payload.messages ?? [];
  return rawMessages
    .map((item) => (typeof item === 'string' ? item : item.text ?? ''))
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .slice(0, 3);
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json(405, { success: false, error: 'Metodo nao permitido.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openAiKey = Deno.env.get('OPENAI_API_KEY');

  if (!supabaseUrl || !serviceRoleKey || !openAiKey) {
    return json(500, { success: false, error: 'Servico de geracao nao configurado.' });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return json(401, { success: false, error: 'Autenticacao obrigatoria.' });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json(400, { success: false, error: 'Payload invalido.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(authorization.replace('Bearer ', ''));

  if (userError || !user) {
    return json(401, { success: false, error: 'Sessao invalida.' });
  }

  const { workspace_id, lead_id, campaign_id } = parsed.data;

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return json(403, { success: false, error: 'Acesso ao workspace negado.' });
  }

  const [{ data: lead }, { data: campaign }, { data: customValues }] = await Promise.all([
    supabase.from('leads').select('*').eq('workspace_id', workspace_id).eq('id', lead_id).single(),
    supabase.from('campaigns').select('*').eq('workspace_id', workspace_id).eq('id', campaign_id).eq('is_active', true).single(),
    supabase
      .from('lead_custom_field_values')
      .select('value_text, workspace_custom_fields(name, field_key)')
      .eq('workspace_id', workspace_id)
      .eq('lead_id', lead_id),
  ]);

  if (!lead || !campaign) {
    return json(404, { success: false, error: 'Lead ou campanha nao encontrados.' });
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
    'Voce e um especialista em pre-vendas B2B.',
    'Gere exatamente 3 mensagens curtas, profissionais e personalizadas para abordagem SDR.',
    'Nao invente dados nao fornecidos. Nao use markdown. Retorne JSON valido no formato {"messages":[{"text":"..."}]}.',
    `Contexto da campanha: ${campaign.context_text}`,
    `Instrucao da campanha: ${campaign.generation_prompt}`,
    `Dados do lead: ${JSON.stringify(leadContext)}`,
  ].join('\n\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Retorne somente JSON valido.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return json(502, { success: false, error: 'Provedor de IA indisponivel.' });
    }

    const completion = await response.json();
    const content = completion.choices?.[0]?.message?.content;
    const generated = sanitizeMessages(JSON.parse(content ?? '{}'));

    if (generated.length < 2) {
      return json(502, { success: false, error: 'Resposta da IA veio vazia ou incompleta.' });
    }

    const rows = generated.map((messageText, index) => ({
      workspace_id,
      lead_id,
      campaign_id,
      variation_index: index + 1,
      message_text: messageText,
      generation_status: 'generated',
      generated_by_user_id: user.id,
    }));

    const { data: savedMessages, error: insertError } = await supabase.from('generated_messages').insert(rows).select();
    if (insertError) {
      return json(500, { success: false, error: 'Falha ao salvar mensagens geradas.' });
    }

    return json(200, { success: true, data: { messages: savedMessages } });
  } catch (_error) {
    return json(502, { success: false, error: 'Falha segura ao gerar mensagens. Tente novamente.' });
  } finally {
    clearTimeout(timeout);
  }
});
