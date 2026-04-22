create table if not exists public.conversation_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  channel text not null default 'email' check (channel in ('email', 'whatsapp', 'linkedin')),
  status text not null default 'open' check (
    status in ('open', 'positive', 'neutral', 'negative', 'meeting_scheduled', 'closed')
  ),
  sentiment_tag text not null default 'neutral' check (sentiment_tag in ('positive', 'neutral', 'negative', 'mixed')),
  simulation_enabled boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  thread_id uuid not null references public.conversation_threads(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  sender_type text not null check (sender_type in ('sdr_ai', 'client', 'system')),
  sender_name text not null check (char_length(sender_name) between 2 and 120),
  message_text text not null check (char_length(message_text) between 1 and 2400),
  model_name text,
  prompt_purpose text,
  sentiment_tag text check (sentiment_tag in ('positive', 'neutral', 'negative', 'mixed')),
  intent_tag text,
  generated_by text not null default 'user' check (generated_by in ('openai', 'user', 'seed')),
  token_usage jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_simulation_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  thread_id uuid not null references public.conversation_threads(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_conversation_threads_workspace on public.conversation_threads(workspace_id, updated_at desc);
create index if not exists idx_conversation_threads_lead on public.conversation_threads(workspace_id, lead_id);
create index if not exists idx_conversation_messages_thread on public.conversation_messages(thread_id, created_at);
create index if not exists idx_conversation_tokens_hash on public.conversation_simulation_tokens(token_hash);

create or replace function public.ensure_conversation_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  target_lead_id uuid;
  target_campaign_id uuid;
begin
  if tg_table_name = 'conversation_threads' then
    if not exists (
      select 1 from public.leads l
      where l.id = new.lead_id
        and l.workspace_id = new.workspace_id
    ) then
      raise exception 'INVALID_THREAD_LEAD_WORKSPACE';
    end if;

    if not exists (
      select 1 from public.campaigns c
      where c.id = new.campaign_id
        and c.workspace_id = new.workspace_id
    ) then
      raise exception 'INVALID_THREAD_CAMPAIGN_WORKSPACE';
    end if;
  end if;

  if tg_table_name = 'conversation_messages' then
    select ct.workspace_id, ct.lead_id, ct.campaign_id
      into target_workspace_id, target_lead_id, target_campaign_id
    from public.conversation_threads ct
    where ct.id = new.thread_id;

    if target_workspace_id is null then
      raise exception 'INVALID_CONVERSATION_THREAD';
    end if;

    if new.workspace_id <> target_workspace_id
      or new.lead_id <> target_lead_id
      or new.campaign_id <> target_campaign_id then
      raise exception 'INVALID_CONVERSATION_MESSAGE_CONTEXT';
    end if;
  end if;

  if tg_table_name = 'conversation_simulation_tokens' then
    if not exists (
      select 1 from public.conversation_threads ct
      where ct.id = new.thread_id
        and ct.workspace_id = new.workspace_id
    ) then
      raise exception 'INVALID_CONVERSATION_TOKEN_THREAD';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_conversation_threads_integrity on public.conversation_threads;
create trigger trg_conversation_threads_integrity
  before insert or update on public.conversation_threads
  for each row execute function public.ensure_conversation_integrity();

drop trigger if exists trg_conversation_messages_integrity on public.conversation_messages;
create trigger trg_conversation_messages_integrity
  before insert or update on public.conversation_messages
  for each row execute function public.ensure_conversation_integrity();

drop trigger if exists trg_conversation_tokens_integrity on public.conversation_simulation_tokens;
create trigger trg_conversation_tokens_integrity
  before insert or update on public.conversation_simulation_tokens
  for each row execute function public.ensure_conversation_integrity();

alter table public.conversation_threads enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_simulation_tokens enable row level security;

drop policy if exists "conversation_threads_all_member" on public.conversation_threads;
create policy "conversation_threads_all_member" on public.conversation_threads
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "conversation_messages_all_member" on public.conversation_messages;
create policy "conversation_messages_all_member" on public.conversation_messages
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "conversation_tokens_all_member" on public.conversation_simulation_tokens;
create policy "conversation_tokens_all_member" on public.conversation_simulation_tokens
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on table public.conversation_threads to authenticated;
grant select, insert, update, delete on table public.conversation_messages to authenticated;
grant select, insert, update, delete on table public.conversation_simulation_tokens to authenticated;
grant execute on function public.ensure_conversation_integrity() to authenticated;
