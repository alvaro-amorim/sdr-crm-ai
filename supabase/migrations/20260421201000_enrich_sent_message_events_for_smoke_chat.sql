alter table public.sent_message_events
  add column if not exists direction text not null default 'outbound',
  add column if not exists sender_name text,
  add column if not exists channel text not null default 'email',
  add column if not exists delivery_status text not null default 'sent';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sent_message_events_direction_check'
  ) then
    alter table public.sent_message_events
      add constraint sent_message_events_direction_check
      check (direction in ('outbound', 'inbound'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'sent_message_events_delivery_status_check'
  ) then
    alter table public.sent_message_events
      add constraint sent_message_events_delivery_status_check
      check (delivery_status in ('draft', 'scheduled', 'sent', 'delivered', 'read', 'replied'));
  end if;
end $$;
