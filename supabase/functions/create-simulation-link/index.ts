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
  thread_id: z.string().uuid(),
  origin: z.string().url().optional(),
});

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

function createToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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

  if (!supabaseUrl || !publishableKey) {
    return json(500, { success: false, error: 'Serviço de simulação não configurado.' });
  }

  const authorization = request.headers.get('Authorization');
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

  const { workspace_id, thread_id, origin } = parsed.data;

  const { data: membership } = await userClient
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspace_id)
    .eq('user_id', userId)
    .single();

  if (!membership) {
    return json(403, { success: false, error: 'Acesso ao workspace negado.' });
  }

  const { data: thread } = await userClient
    .from('conversation_threads')
    .select('id, simulation_enabled')
    .eq('workspace_id', workspace_id)
    .eq('id', thread_id)
    .single();

  if (!thread || !thread.simulation_enabled) {
    return json(404, { success: false, error: 'Conversa não encontrada ou sem simulação ativa.' });
  }

  const plainToken = createToken();
  const tokenHash = await sha256(plainToken);
  const { error: insertError } = await userClient.from('conversation_simulation_tokens').insert({
    workspace_id,
    thread_id,
    token_hash: tokenHash,
    created_by: userId,
  });

  if (insertError) {
    return json(500, { success: false, error: 'Falha ao gerar link de simulação.' });
  }

  const baseUrl = origin ?? request.headers.get('Origin') ?? 'http://localhost:5173';
  const url = `${baseUrl.replace(/\/$/, '')}/client-simulator?token=${encodeURIComponent(plainToken)}`;

  return json(200, { success: true, data: { url, expires_in_days: 14 } });
});
