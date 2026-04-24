alter table public.leads
  add column if not exists technical_owner_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_technical_owner_name_length'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_technical_owner_name_length
      check (technical_owner_name is null or char_length(technical_owner_name) <= 140);
  end if;
end $$;

delete from public.stage_required_fields existing
using public.stage_required_fields legacy
where existing.stage_id = legacy.stage_id
  and existing.field_key = 'technical_owner_name'
  and legacy.field_key = 'assigned_user_id';

update public.stage_required_fields
set field_key = 'technical_owner_name'
where field_key = 'assigned_user_id';
