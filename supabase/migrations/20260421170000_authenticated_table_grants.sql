grant usage on schema public to authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.workspaces to authenticated;
grant select, insert, update, delete on table public.workspace_members to authenticated;
grant select, insert, update, delete on table public.pipeline_stages to authenticated;
grant select, insert, update, delete on table public.workspace_custom_fields to authenticated;
grant select, insert, update, delete on table public.stage_required_fields to authenticated;
grant select, insert, update, delete on table public.leads to authenticated;
grant select, insert, update, delete on table public.lead_custom_field_values to authenticated;
grant select, insert, update, delete on table public.campaigns to authenticated;
grant select, insert, update, delete on table public.generated_messages to authenticated;
grant select, insert, update, delete on table public.sent_message_events to authenticated;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.is_workspace_record_owner(uuid) to authenticated;
grant execute on function public.create_workspace_with_defaults(text) to authenticated;
