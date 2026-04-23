drop policy if exists "profiles_select_workspace_members" on public.profiles;

create policy "profiles_select_workspace_members" on public.profiles
for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.workspace_members target_member
    join public.workspace_members current_member
      on current_member.workspace_id = target_member.workspace_id
    where target_member.user_id = profiles.id
      and current_member.user_id = auth.uid()
  )
);
