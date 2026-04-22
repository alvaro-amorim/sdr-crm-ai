drop function if exists public.append_simulation_exchange(text, text, text, text, jsonb, text, text, text, text, boolean);

create or replace function public.append_simulation_exchange(
  target_token_hash text,
  client_message text,
  ai_message text,
  ai_model text,
  ai_usage jsonb,
  ai_sentiment text,
  ai_intent text,
  ai_prompt_purpose text,
  ai_thread_status text,
  ai_stage_action text,
  ai_should_close boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_record public.conversation_simulation_tokens;
  thread_record public.conversation_threads;
  updated_thread_record public.conversation_threads;
  client_name text;
  inbound_record public.conversation_messages;
  outbound_record public.conversation_messages;
  messages_record jsonb;
  target_stage_id uuid;
  normalized_sentiment text := case
    when ai_sentiment in ('positive', 'neutral', 'negative', 'mixed') then ai_sentiment
    else 'neutral'
  end;
  normalized_thread_status text := case
    when ai_thread_status in ('open', 'positive', 'neutral', 'negative', 'meeting_scheduled', 'closed') then ai_thread_status
    else 'neutral'
  end;
  normalized_stage_action text := case
    when ai_stage_action in ('desqualificado', 'qualificado', 'reuniao_agendada', 'tentando_contato', 'conexao_iniciada') then ai_stage_action
    else 'keep_current'
  end;
  normalized_prompt_purpose text := case
    when ai_prompt_purpose in ('opening', 'secondary_follow_up', 'qualification_follow_up', 'closing_note', 'meeting_confirmation') then ai_prompt_purpose
    when coalesce(ai_should_close, false) then 'closing_note'
    else 'qualification_follow_up'
  end;
begin
  select *
  into token_record
  from public.conversation_simulation_tokens
  where token_hash = target_token_hash
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if token_record.id is null then
    return null;
  end if;

  select *
  into thread_record
  from public.conversation_threads
  where id = token_record.thread_id
    and workspace_id = token_record.workspace_id
    and simulation_enabled = true;

  if thread_record.id is null then
    return null;
  end if;

  select coalesce(split_part(l.name, ' ', 1), 'Cliente')
  into client_name
  from public.leads l
  where l.id = thread_record.lead_id
    and l.workspace_id = thread_record.workspace_id;

  insert into public.conversation_messages (
    workspace_id,
    thread_id,
    lead_id,
    campaign_id,
    direction,
    sender_type,
    sender_name,
    message_text,
    sentiment_tag,
    intent_tag,
    generated_by
  )
  values (
    thread_record.workspace_id,
    thread_record.id,
    thread_record.lead_id,
    thread_record.campaign_id,
    'inbound',
    'client',
    coalesce(nullif(client_name, ''), 'Cliente'),
    trim(client_message),
    normalized_sentiment,
    'simulator_client_reply',
    'user'
  )
  returning * into inbound_record;

  insert into public.conversation_messages (
    workspace_id,
    thread_id,
    lead_id,
    campaign_id,
    direction,
    sender_type,
    sender_name,
    message_text,
    model_name,
    prompt_purpose,
    sentiment_tag,
    intent_tag,
    generated_by,
    token_usage
  )
  values (
    thread_record.workspace_id,
    thread_record.id,
    thread_record.lead_id,
    thread_record.campaign_id,
    'outbound',
    'sdr_ai',
    'SDR Expert',
    trim(ai_message),
    ai_model,
    normalized_prompt_purpose,
    normalized_sentiment,
    coalesce(nullif(trim(ai_intent), ''), normalized_prompt_purpose),
    'openai',
    ai_usage
  )
  returning * into outbound_record;

  if normalized_stage_action <> 'keep_current' then
    select ps.id
    into target_stage_id
    from public.pipeline_stages ps
    where ps.workspace_id = thread_record.workspace_id
      and translate(lower(ps.name), 'áàãâéêíóôõúç', 'aaaaeeiooouc') = case normalized_stage_action
        when 'desqualificado' then 'desqualificado'
        when 'qualificado' then 'qualificado'
        when 'reuniao_agendada' then 'reuniao agendada'
        when 'tentando_contato' then 'tentando contato'
        when 'conexao_iniciada' then 'conexao iniciada'
        else ''
      end
    limit 1;

    if target_stage_id is not null then
      update public.leads
      set current_stage_id = target_stage_id,
          updated_at = now()
      where id = thread_record.lead_id
        and workspace_id = thread_record.workspace_id;
    end if;
  end if;

  update public.conversation_threads
  set
    sentiment_tag = normalized_sentiment,
    status = normalized_thread_status,
    updated_at = now()
  where id = thread_record.id
  returning * into updated_thread_record;

  update public.conversation_simulation_tokens
  set last_used_at = now()
  where id = token_record.id;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at asc), '[]'::jsonb)
  into messages_record
  from public.conversation_messages m
  where m.workspace_id = thread_record.workspace_id
    and m.thread_id = thread_record.id;

  return jsonb_build_object(
    'thread', to_jsonb(updated_thread_record),
    'messages', messages_record,
    'inbound', to_jsonb(inbound_record),
    'outbound', to_jsonb(outbound_record)
  );
end;
$$;

revoke all on function public.append_simulation_exchange(text, text, text, text, jsonb, text, text, text, text, text, boolean) from public;
grant execute on function public.append_simulation_exchange(text, text, text, text, jsonb, text, text, text, text, text, boolean) to anon, authenticated;
