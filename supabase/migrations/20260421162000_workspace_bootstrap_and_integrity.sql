create or replace function public.create_workspace_with_defaults(workspace_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace public.workspaces;
  stage_names text[] := array[
    'Base',
    'Lead Mapeado',
    'Tentando Contato',
    'Conexao Iniciada',
    'Desqualificado',
    'Qualificado',
    'Reuniao Agendada'
  ];
  stage_name text;
  stage_position integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if workspace_name is null or char_length(trim(workspace_name)) < 2 or char_length(trim(workspace_name)) > 120 then
    raise exception 'INVALID_WORKSPACE_NAME';
  end if;

  insert into public.workspaces (name, owner_user_id)
  values (trim(workspace_name), auth.uid())
  returning * into new_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace.id, auth.uid(), 'owner');

  foreach stage_name in array stage_names loop
    insert into public.pipeline_stages (workspace_id, name, position, is_default)
    values (new_workspace.id, stage_name, stage_position, true);
    stage_position := stage_position + 1;
  end loop;

  return new_workspace;
end;
$$;

revoke all on function public.create_workspace_with_defaults(text) from public;
grant execute on function public.create_workspace_with_defaults(text) to authenticated;

create or replace function public.is_workspace_record_owner(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace_id
      and w.owner_user_id = auth.uid()
  );
$$;

drop policy if exists "workspaces_select_member" on public.workspaces;
drop policy if exists "workspaces_select_member_or_owner" on public.workspaces;
create policy "workspaces_select_member_or_owner" on public.workspaces
  for select
  using (owner_user_id = auth.uid() or public.is_workspace_member(id));

drop policy if exists "workspace_members_insert_owner_self" on public.workspace_members;
create policy "workspace_members_insert_owner_self" on public.workspace_members
  for insert
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and public.is_workspace_record_owner(workspace_id)
  );

create or replace function public.ensure_workspace_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'leads' then
    if not exists (
      select 1 from public.pipeline_stages ps
      where ps.id = new.current_stage_id
        and ps.workspace_id = new.workspace_id
    ) then
      raise exception 'INVALID_STAGE_WORKSPACE';
    end if;

    if new.assigned_user_id is not null and not exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = new.workspace_id
        and wm.user_id = new.assigned_user_id
    ) then
      raise exception 'INVALID_ASSIGNED_USER_WORKSPACE';
    end if;
  end if;

  if tg_table_name = 'stage_required_fields' then
    if not exists (
      select 1 from public.pipeline_stages ps
      where ps.id = new.stage_id
        and ps.workspace_id = new.workspace_id
    ) then
      raise exception 'INVALID_STAGE_WORKSPACE';
    end if;

    if new.custom_field_id is not null and not exists (
      select 1 from public.workspace_custom_fields cf
      where cf.id = new.custom_field_id
        and cf.workspace_id = new.workspace_id
    ) then
      raise exception 'INVALID_CUSTOM_FIELD_WORKSPACE';
    end if;
  end if;

  if tg_table_name = 'lead_custom_field_values' then
    if not exists (
      select 1 from public.leads l
      where l.id = new.lead_id
        and l.workspace_id = new.workspace_id
    ) then
      raise exception 'INVALID_LEAD_WORKSPACE';
    end if;

    if not exists (
      select 1 from public.workspace_custom_fields cf
      where cf.id = new.custom_field_id
        and cf.workspace_id = new.workspace_id
    ) then
      raise exception 'INVALID_CUSTOM_FIELD_WORKSPACE';
    end if;
  end if;

  if tg_table_name = 'campaigns' and new.trigger_stage_id is not null then
    if not exists (
      select 1 from public.pipeline_stages ps
      where ps.id = new.trigger_stage_id
        and ps.workspace_id = new.workspace_id
    ) then
      raise exception 'INVALID_TRIGGER_STAGE_WORKSPACE';
    end if;
  end if;

  if tg_table_name = 'generated_messages' then
    if not exists (
      select 1 from public.leads l
      where l.id = new.lead_id
        and l.workspace_id = new.workspace_id
    ) then
      raise exception 'INVALID_LEAD_WORKSPACE';
    end if;

    if not exists (
      select 1 from public.campaigns c
      where c.id = new.campaign_id
        and c.workspace_id = new.workspace_id
    ) then
      raise exception 'INVALID_CAMPAIGN_WORKSPACE';
    end if;
  end if;

  if tg_table_name = 'sent_message_events' then
    if not exists (
      select 1 from public.leads l
      where l.id = new.lead_id
        and l.workspace_id = new.workspace_id
    ) then
      raise exception 'INVALID_LEAD_WORKSPACE';
    end if;

    if not exists (
      select 1 from public.campaigns c
      where c.id = new.campaign_id
        and c.workspace_id = new.workspace_id
    ) then
      raise exception 'INVALID_CAMPAIGN_WORKSPACE';
    end if;

    if new.generated_message_id is not null and not exists (
      select 1 from public.generated_messages gm
      where gm.id = new.generated_message_id
        and gm.workspace_id = new.workspace_id
        and gm.lead_id = new.lead_id
        and gm.campaign_id = new.campaign_id
    ) then
      raise exception 'INVALID_GENERATED_MESSAGE_WORKSPACE';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leads_workspace_integrity on public.leads;
create trigger trg_leads_workspace_integrity
  before insert or update on public.leads
  for each row execute function public.ensure_workspace_integrity();

drop trigger if exists trg_stage_required_fields_workspace_integrity on public.stage_required_fields;
create trigger trg_stage_required_fields_workspace_integrity
  before insert or update on public.stage_required_fields
  for each row execute function public.ensure_workspace_integrity();

drop trigger if exists trg_lead_custom_values_workspace_integrity on public.lead_custom_field_values;
create trigger trg_lead_custom_values_workspace_integrity
  before insert or update on public.lead_custom_field_values
  for each row execute function public.ensure_workspace_integrity();

drop trigger if exists trg_campaigns_workspace_integrity on public.campaigns;
create trigger trg_campaigns_workspace_integrity
  before insert or update on public.campaigns
  for each row execute function public.ensure_workspace_integrity();

drop trigger if exists trg_generated_messages_workspace_integrity on public.generated_messages;
create trigger trg_generated_messages_workspace_integrity
  before insert or update on public.generated_messages
  for each row execute function public.ensure_workspace_integrity();

drop trigger if exists trg_sent_message_events_workspace_integrity on public.sent_message_events;
create trigger trg_sent_message_events_workspace_integrity
  before insert or update on public.sent_message_events
  for each row execute function public.ensure_workspace_integrity();
