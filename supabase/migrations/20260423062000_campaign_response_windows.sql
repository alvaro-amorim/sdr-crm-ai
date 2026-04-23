alter table public.campaigns
  add column if not exists ai_response_mode text not null default 'always'
    check (ai_response_mode in ('always', 'business_hours')),
  add column if not exists ai_response_window_start time not null default time '09:00',
  add column if not exists ai_response_window_end time not null default time '18:00';

create table if not exists public.scheduled_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  thread_id uuid not null references public.conversation_threads(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  message_text text not null check (char_length(message_text) between 1 and 2400),
  model_name text,
  prompt_purpose text,
  sentiment_tag text check (sentiment_tag in ('positive', 'neutral', 'negative', 'mixed')),
  intent_tag text,
  generated_by text not null default 'openai' check (generated_by in ('openai', 'user', 'seed')),
  token_usage jsonb,
  thread_status text not null default 'open' check (thread_status in ('open', 'positive', 'neutral', 'negative', 'meeting_scheduled', 'closed')),
  lead_stage_action text not null default 'keep_current' check (
    lead_stage_action in ('keep_current', 'desqualificado', 'qualificado', 'reuniao_agendada', 'tentando_contato', 'conexao_iniciada')
  ),
  should_close boolean not null default false,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'canceled')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_scheduled_conversation_messages_due
  on public.scheduled_conversation_messages(status, scheduled_for);

create index if not exists idx_scheduled_conversation_messages_thread
  on public.scheduled_conversation_messages(workspace_id, thread_id, status);

alter table public.scheduled_conversation_messages enable row level security;

drop policy if exists "scheduled_conversation_messages_select_member" on public.scheduled_conversation_messages;
create policy "scheduled_conversation_messages_select_member" on public.scheduled_conversation_messages
for select
using (public.is_workspace_member(workspace_id));

grant select on table public.scheduled_conversation_messages to authenticated;

create or replace function public.process_due_scheduled_simulation_messages(target_token_hash text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  token_record public.conversation_simulation_tokens;
  scheduled_record public.scheduled_conversation_messages;
  inserted_count integer := 0;
  target_stage_id uuid;
begin
  select *
  into token_record
  from public.conversation_simulation_tokens
  where token_hash = target_token_hash
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if token_record.id is null then
    return 0;
  end if;

  for scheduled_record in
    select *
    from public.scheduled_conversation_messages
    where workspace_id = token_record.workspace_id
      and thread_id = token_record.thread_id
      and status = 'pending'
      and scheduled_for <= now()
    order by scheduled_for asc, created_at asc
  loop
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
      scheduled_record.workspace_id,
      scheduled_record.thread_id,
      scheduled_record.lead_id,
      scheduled_record.campaign_id,
      'outbound',
      'sdr_ai',
      'SDR Expert',
      scheduled_record.message_text,
      scheduled_record.model_name,
      scheduled_record.prompt_purpose,
      scheduled_record.sentiment_tag,
      scheduled_record.intent_tag,
      scheduled_record.generated_by,
      scheduled_record.token_usage
    );

    update public.scheduled_conversation_messages
    set status = 'sent',
        sent_at = now()
    where id = scheduled_record.id;

    if scheduled_record.lead_stage_action <> 'keep_current' then
      select ps.id
      into target_stage_id
      from public.pipeline_stages ps
      where ps.workspace_id = scheduled_record.workspace_id
        and translate(lower(ps.name), 'áàãâéêíóôõúç', 'aaaaeeiooouc') = case scheduled_record.lead_stage_action
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
        where id = scheduled_record.lead_id
          and workspace_id = scheduled_record.workspace_id;
      end if;
    end if;

    update public.conversation_threads
    set sentiment_tag = coalesce(scheduled_record.sentiment_tag, sentiment_tag),
        status = scheduled_record.thread_status,
        updated_at = now()
    where id = scheduled_record.thread_id
      and workspace_id = scheduled_record.workspace_id;

    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.process_due_scheduled_simulation_messages(text) from public;
grant execute on function public.process_due_scheduled_simulation_messages(text) to anon, authenticated;

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
  pending_record jsonb;
  processed_count integer;
begin
  processed_count := public.process_due_scheduled_simulation_messages(target_token_hash);

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

  select to_jsonb(s)
  into pending_record
  from public.scheduled_conversation_messages s
  where s.workspace_id = token_record.workspace_id
    and s.thread_id = token_record.thread_id
    and s.status = 'pending'
  order by s.scheduled_for asc, s.created_at asc
  limit 1;

  update public.conversation_simulation_tokens
  set last_used_at = now()
  where id = token_record.id;

  return jsonb_build_object(
    'thread', thread_record,
    'messages', messages_record,
    'pending_message', pending_record,
    'processed_scheduled_messages', processed_count
  );
end;
$$;

revoke all on function public.get_simulation_context(text) from public;
grant execute on function public.get_simulation_context(text) to anon, authenticated;

create or replace function public.append_scheduled_simulation_exchange(
  target_token_hash text,
  client_message text,
  away_message text,
  scheduled_ai_message text,
  scheduled_for timestamptz,
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
  client_name text;
  inbound_record public.conversation_messages;
  away_record public.conversation_messages;
  scheduled_record public.scheduled_conversation_messages;
  messages_record jsonb;
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
    trim(away_message),
    'business-hours-rule',
    'outside_business_hours_notice',
    'neutral',
    'outside_business_hours_notice',
    'openai',
    null
  )
  returning * into away_record;

  insert into public.scheduled_conversation_messages (
    workspace_id,
    thread_id,
    lead_id,
    campaign_id,
    message_text,
    model_name,
    prompt_purpose,
    sentiment_tag,
    intent_tag,
    generated_by,
    token_usage,
    thread_status,
    lead_stage_action,
    should_close,
    scheduled_for
  )
  values (
    thread_record.workspace_id,
    thread_record.id,
    thread_record.lead_id,
    thread_record.campaign_id,
    trim(scheduled_ai_message),
    ai_model,
    normalized_prompt_purpose,
    normalized_sentiment,
    coalesce(nullif(trim(ai_intent), ''), normalized_prompt_purpose),
    'openai',
    ai_usage,
    normalized_thread_status,
    normalized_stage_action,
    coalesce(ai_should_close, false),
    scheduled_for
  )
  returning * into scheduled_record;

  update public.conversation_threads
  set updated_at = now()
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
    'outbound', to_jsonb(away_record),
    'pending_message', to_jsonb(scheduled_record)
  );
end;
$$;

revoke all on function public.append_scheduled_simulation_exchange(text, text, text, text, timestamptz, text, jsonb, text, text, text, text, text, boolean) from public;
grant execute on function public.append_scheduled_simulation_exchange(text, text, text, text, timestamptz, text, jsonb, text, text, text, text, text, boolean) to anon, authenticated;
