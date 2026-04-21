create or replace function public.ensure_workspace_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb := to_jsonb(new);
  target_workspace_id uuid := (payload ->> 'workspace_id')::uuid;
  target_stage_id uuid := (payload ->> 'stage_id')::uuid;
  target_current_stage_id uuid := (payload ->> 'current_stage_id')::uuid;
  target_assigned_user_id uuid := (payload ->> 'assigned_user_id')::uuid;
  target_custom_field_id uuid := (payload ->> 'custom_field_id')::uuid;
  target_lead_id uuid := (payload ->> 'lead_id')::uuid;
  target_campaign_id uuid := (payload ->> 'campaign_id')::uuid;
  target_trigger_stage_id uuid := (payload ->> 'trigger_stage_id')::uuid;
  target_generated_message_id uuid := (payload ->> 'generated_message_id')::uuid;
begin
  if tg_table_name = 'leads' then
    if not exists (
      select 1
      from public.pipeline_stages ps
      where ps.id = target_current_stage_id
        and ps.workspace_id = target_workspace_id
    ) then
      raise exception 'INVALID_STAGE_WORKSPACE';
    end if;

    if target_assigned_user_id is not null and not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = target_assigned_user_id
    ) then
      raise exception 'INVALID_ASSIGNED_USER_WORKSPACE';
    end if;
  end if;

  if tg_table_name = 'stage_required_fields' then
    if not exists (
      select 1
      from public.pipeline_stages ps
      where ps.id = target_stage_id
        and ps.workspace_id = target_workspace_id
    ) then
      raise exception 'INVALID_STAGE_WORKSPACE';
    end if;

    if target_custom_field_id is not null and not exists (
      select 1
      from public.workspace_custom_fields cf
      where cf.id = target_custom_field_id
        and cf.workspace_id = target_workspace_id
    ) then
      raise exception 'INVALID_CUSTOM_FIELD_WORKSPACE';
    end if;
  end if;

  if tg_table_name = 'lead_custom_field_values' then
    if not exists (
      select 1
      from public.leads l
      where l.id = target_lead_id
        and l.workspace_id = target_workspace_id
    ) then
      raise exception 'INVALID_LEAD_WORKSPACE';
    end if;

    if not exists (
      select 1
      from public.workspace_custom_fields cf
      where cf.id = target_custom_field_id
        and cf.workspace_id = target_workspace_id
    ) then
      raise exception 'INVALID_CUSTOM_FIELD_WORKSPACE';
    end if;
  end if;

  if tg_table_name = 'campaigns' and target_trigger_stage_id is not null then
    if not exists (
      select 1
      from public.pipeline_stages ps
      where ps.id = target_trigger_stage_id
        and ps.workspace_id = target_workspace_id
    ) then
      raise exception 'INVALID_TRIGGER_STAGE_WORKSPACE';
    end if;
  end if;

  if tg_table_name = 'generated_messages' then
    if not exists (
      select 1
      from public.leads l
      where l.id = target_lead_id
        and l.workspace_id = target_workspace_id
    ) then
      raise exception 'INVALID_LEAD_WORKSPACE';
    end if;

    if not exists (
      select 1
      from public.campaigns c
      where c.id = target_campaign_id
        and c.workspace_id = target_workspace_id
    ) then
      raise exception 'INVALID_CAMPAIGN_WORKSPACE';
    end if;
  end if;

  if tg_table_name = 'sent_message_events' then
    if not exists (
      select 1
      from public.leads l
      where l.id = target_lead_id
        and l.workspace_id = target_workspace_id
    ) then
      raise exception 'INVALID_LEAD_WORKSPACE';
    end if;

    if not exists (
      select 1
      from public.campaigns c
      where c.id = target_campaign_id
        and c.workspace_id = target_workspace_id
    ) then
      raise exception 'INVALID_CAMPAIGN_WORKSPACE';
    end if;

    if target_generated_message_id is not null and not exists (
      select 1
      from public.generated_messages gm
      where gm.id = target_generated_message_id
        and gm.workspace_id = target_workspace_id
        and gm.lead_id = target_lead_id
        and gm.campaign_id = target_campaign_id
    ) then
      raise exception 'INVALID_GENERATED_MESSAGE_WORKSPACE';
    end if;
  end if;

  return new;
end;
$$;
