update public.pipeline_stages
set name = 'Conexão Iniciada'
where name = 'Conexao Iniciada';

update public.pipeline_stages
set name = 'Reunião Agendada'
where name = 'Reuniao Agendada';

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
    'Conexão Iniciada',
    'Desqualificado',
    'Qualificado',
    'Reunião Agendada'
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
