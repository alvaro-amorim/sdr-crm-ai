create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  position integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, name),
  unique (workspace_id, position)
);

create table if not exists public.workspace_custom_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  field_key text not null check (field_key ~ '^[a-z0-9_]{2,48}$'),
  field_type text not null check (field_type in ('text', 'number')),
  created_at timestamptz not null default now(),
  unique (workspace_id, field_key)
);

create table if not exists public.stage_required_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages(id) on delete cascade,
  field_key text,
  custom_field_id uuid references public.workspace_custom_fields(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (field_key is not null and custom_field_id is null)
    or (field_key is null and custom_field_id is not null)
  ),
  unique (stage_id, field_key),
  unique (stage_id, custom_field_id)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  current_stage_id uuid not null references public.pipeline_stages(id),
  assigned_user_id uuid references auth.users(id),
  name text not null check (char_length(name) between 1 and 140),
  email text,
  phone text,
  company text,
  job_title text,
  lead_source text,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_custom_field_values (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  custom_field_id uuid not null references public.workspace_custom_fields(id) on delete cascade,
  value_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, custom_field_id)
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  context_text text not null check (char_length(context_text) between 5 and 4000),
  generation_prompt text not null check (char_length(generation_prompt) between 5 and 4000),
  trigger_stage_id uuid references public.pipeline_stages(id),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  variation_index integer not null check (variation_index between 1 and 3),
  message_text text not null check (char_length(message_text) between 1 and 2000),
  generation_status text not null default 'generated' check (generation_status in ('generated', 'sent', 'failed')),
  generated_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sent_message_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  generated_message_id uuid references public.generated_messages(id),
  message_text text not null,
  sent_by_user_id uuid not null references auth.users(id),
  is_simulated boolean not null default true,
  sent_at timestamptz not null default now()
);

create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_pipeline_stages_workspace on public.pipeline_stages(workspace_id, position);
create index if not exists idx_leads_workspace_stage on public.leads(workspace_id, current_stage_id);
create index if not exists idx_campaigns_workspace on public.campaigns(workspace_id);
create index if not exists idx_messages_workspace_lead on public.generated_messages(workspace_id, lead_id);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.workspace_custom_fields enable row level security;
alter table public.stage_required_fields enable row level security;
alter table public.leads enable row level security;
alter table public.lead_custom_field_values enable row level security;
alter table public.campaigns enable row level security;
alter table public.generated_messages enable row level security;
alter table public.sent_message_events enable row level security;

create policy "profiles_select_self" on public.profiles for select using (id = auth.uid());
create policy "profiles_upsert_self" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "workspaces_select_member" on public.workspaces for select using (public.is_workspace_member(id));
create policy "workspaces_insert_owner" on public.workspaces for insert with check (owner_user_id = auth.uid());
create policy "workspaces_update_owner" on public.workspaces for update using (public.is_workspace_owner(id)) with check (public.is_workspace_owner(id));

create policy "workspace_members_select_member" on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy "workspace_members_insert_owner_self" on public.workspace_members
  for insert
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_user_id = auth.uid()
    )
  );

create policy "pipeline_stages_all_member" on public.pipeline_stages
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "custom_fields_all_member" on public.workspace_custom_fields
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "stage_required_fields_all_member" on public.stage_required_fields
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "leads_all_member" on public.leads
  for all using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and (
      assigned_user_id is null
      or exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = leads.workspace_id
          and wm.user_id = assigned_user_id
      )
    )
  );

create policy "lead_custom_values_all_member" on public.lead_custom_field_values
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "campaigns_all_member" on public.campaigns
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "generated_messages_all_member" on public.generated_messages
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "sent_message_events_all_member" on public.sent_message_events
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
