alter table public.email_notifications
  add column if not exists delivery_status text not null default 'pending';

alter table public.email_notifications
  add column if not exists delivery_error text;

alter table public.email_notifications
  add column if not exists resend_id text;

alter table public.email_notifications
  add column if not exists sent_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_notifications_delivery_status_check'
  ) then
    alter table public.email_notifications
      add constraint email_notifications_delivery_status_check
      check (delivery_status in ('pending', 'sending', 'sent', 'failed', 'skipped'));
  end if;
end $$;

create index if not exists email_notifications_delivery_idx
  on public.email_notifications (delivery_status, created_at desc);

create or replace function public.create_admin_alert(
  p_type text,
  p_subject text,
  p_preview text,
  p_body text,
  p_href text default '/admin/notifications',
  p_event text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.email_notifications;
begin
  insert into public.email_notifications (
    type,
    event,
    direction,
    audience,
    from_label,
    to_label,
    subject,
    preview,
    body,
    href,
    is_read
  )
  values (
    coalesce(nullif(p_type, ''), 'system'),
    p_event,
    'in',
    'admin',
    'Chime Support <alerts@chimesupport.local>',
    (select recipient from public.email_settings where id = 1),
    left(coalesce(p_subject, 'Notification'), 200),
    left(coalesce(p_preview, ''), 180),
    coalesce(p_body, ''),
    coalesce(nullif(p_href, ''), '/admin/notifications'),
    false
  )
  returning * into inserted;

  return to_jsonb(inserted);
end;
$$;

grant execute on function public.create_admin_alert(text, text, text, text, text, text)
  to anon, authenticated;
