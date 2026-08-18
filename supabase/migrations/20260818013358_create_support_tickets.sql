create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where id = auth.uid()
  );
$$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  topic text not null default 'General support',
  status text not null default 'open' check (status in ('open', 'waiting', 'resolved')),
  unread integer not null default 0 check (unread >= 0),
  assigned_admin_id uuid references public.admin_users (id) on delete set null,
  last_message text,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_email_idx on public.support_tickets (customer_email);
create index if not exists support_tickets_last_activity_idx on public.support_tickets (last_activity_at desc);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender text not null check (sender in ('user', 'support')),
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_messages_ticket_idx
  on public.support_ticket_messages (ticket_id, created_at);

create or replace function public.touch_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
  set
    last_message = left(coalesce(new.body, ''), 180),
    last_activity_at = new.created_at,
    unread = case when new.sender = 'user' then unread + 1 else unread end,
    updated_at = now()
  where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists support_ticket_messages_touch on public.support_ticket_messages;
create trigger support_ticket_messages_touch
  after insert on public.support_ticket_messages
  for each row
  execute function public.touch_support_ticket();

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

create policy "Admins can manage support tickets"
  on public.support_tickets
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can manage ticket messages"
  on public.support_ticket_messages
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.support_tickets to authenticated;
grant select, insert, update, delete on public.support_ticket_messages to authenticated;
grant all on public.support_tickets to service_role;
grant all on public.support_ticket_messages to service_role;
