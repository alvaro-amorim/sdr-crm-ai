create or replace function public.get_simulation_context(target_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_record public.conversation_simulation_tokens;
  thread_record jsonb;
  messages_record jsonb;
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

  select to_jsonb(t) ||
    jsonb_build_object(
      'leads', to_jsonb(l),
      'campaigns', to_jsonb(c)
    )
  into thread_record
  from public.conversation_threads t
  join public.leads l on l.id = t.lead_id and l.workspace_id = t.workspace_id
  join public.campaigns c on c.id = t.campaign_id and c.workspace_id = t.workspace_id
  where t.id = token_record.thread_id
    and t.workspace_id = token_record.workspace_id
    and t.simulation_enabled = true;

  if thread_record is null then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at asc), '[]'::jsonb)
  into messages_record
  from public.conversation_messages m
  where m.workspace_id = token_record.workspace_id
    and m.thread_id = token_record.thread_id;

  update public.conversation_simulation_tokens
  set last_used_at = now()
  where id = token_record.id;

  return jsonb_build_object(
    'thread', thread_record,
    'messages', messages_record
  );
end;
$$;

revoke all on function public.get_simulation_context(text) from public;
grant execute on function public.get_simulation_context(text) to anon, authenticated;

create or replace function public.append_simulation_exchange(
  target_token_hash text,
  client_message text,
  ai_message text,
  ai_model text,
  ai_usage jsonb,
  ai_sentiment text,
  ai_intent text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_record public.conversation_simulation_tokens;
  thread_record public.conversation_threads;
  client_name text;
  inbound_record public.conversation_messages;
  outbound_record public.conversation_messages;
  messages_record jsonb;
  normalized_sentiment text := case
    when ai_sentiment in ('positive', 'neutral', 'negative', 'mixed') then ai_sentiment
    else 'neutral'
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
    'neutral',
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
    'simulator_follow_up',
    normalized_sentiment,
    coalesce(nullif(trim(ai_intent), ''), 'follow_up'),
    'openai',
    ai_usage
  )
  returning * into outbound_record;

  update public.conversation_threads
  set
    sentiment_tag = normalized_sentiment,
    status = case
      when normalized_sentiment = 'negative' then 'negative'
      when normalized_sentiment = 'positive' then 'positive'
      else 'neutral'
    end,
    updated_at = now()
  where id = thread_record.id;

  update public.conversation_simulation_tokens
  set last_used_at = now()
  where id = token_record.id;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at asc), '[]'::jsonb)
  into messages_record
  from public.conversation_messages m
  where m.workspace_id = thread_record.workspace_id
    and m.thread_id = thread_record.id;

  return jsonb_build_object(
    'thread', to_jsonb(thread_record),
    'messages', messages_record,
    'inbound', to_jsonb(inbound_record),
    'outbound', to_jsonb(outbound_record)
  );
end;
$$;

revoke all on function public.append_simulation_exchange(text, text, text, text, jsonb, text, text) from public;
grant execute on function public.append_simulation_exchange(text, text, text, text, jsonb, text, text) to anon, authenticated;
