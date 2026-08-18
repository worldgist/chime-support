alter table if exists public.support_tickets
  add column if not exists access_token uuid unique default gen_random_uuid();

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  topic text not null default 'Account issue',
  status text not null default 'open' check (status in ('open', 'waiting', 'resolved')),
  unread integer not null default 0 check (unread >= 0),
  assigned_admin_id uuid references public.admin_users (id) on delete set null,
  access_token uuid unique default gen_random_uuid(),
  last_message text,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender text not null check (sender in ('user', 'support')),
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

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
    unread = case
      when new.sender = 'user' then unread + 1
      when new.sender = 'support' then 0
      else unread
    end,
    status = case
      when new.sender = 'user' and status = 'resolved' then 'open'
      else status
    end,
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

create or replace function public.create_support_ticket(
  p_name text,
  p_email text,
  p_phone text,
  p_topic text default 'Account issue'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.support_tickets;
  greeting text;
begin
  if length(trim(coalesce(p_name, ''))) < 2 or position('@' in coalesce(p_email, '')) = 0 then
    raise exception 'Name and email are required';
  end if;

  insert into public.support_tickets (customer_name, customer_email, customer_phone, topic, status)
  values (
    trim(p_name),
    lower(trim(p_email)),
    nullif(trim(p_phone), ''),
    coalesce(nullif(trim(p_topic), ''), 'Account issue'),
    'open'
  )
  returning * into row;

  greeting := 'Hi ' || split_part(row.customer_name, ' ', 1)
    || '! Thanks for reaching out about your account. A support specialist will chat with you here.';

  insert into public.support_ticket_messages (ticket_id, sender, body)
  values (row.id, 'support', greeting);

  update public.support_tickets set unread = 0 where id = row.id;

  return jsonb_build_object(
    'id', row.id,
    'access_token', row.access_token,
    'topic', row.topic,
    'customer_name', row.customer_name,
    'customer_email', row.customer_email,
    'customer_phone', row.customer_phone
  );
end;
$$;

create or replace function public.get_support_thread(p_id uuid, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket public.support_tickets;
  messages jsonb;
begin
  select * into ticket
  from public.support_tickets
  where id = p_id and access_token = p_token;

  if ticket.id is null then
    raise exception 'Ticket not found';
  end if;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at), '[]'::jsonb)
  into messages
  from public.support_ticket_messages m
  where m.ticket_id = ticket.id;

  return jsonb_build_object('ticket', to_jsonb(ticket), 'messages', messages);
end;
$$;

create or replace function public.add_customer_message(
  p_id uuid,
  p_token uuid,
  p_body text,
  p_attachments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket public.support_tickets;
  inserted public.support_ticket_messages;
begin
  select * into ticket
  from public.support_tickets
  where id = p_id and access_token = p_token;

  if ticket.id is null then
    raise exception 'Ticket not found';
  end if;

  insert into public.support_ticket_messages (ticket_id, sender, body, attachments)
  values (ticket.id, 'user', coalesce(p_body, ''), coalesce(p_attachments, '[]'::jsonb))
  returning * into inserted;

  return to_jsonb(inserted);
end;
$$;

grant execute on function public.create_support_ticket(text, text, text, text) to anon, authenticated;
grant execute on function public.get_support_thread(uuid, uuid) to anon, authenticated;
grant execute on function public.add_customer_message(uuid, uuid, text, jsonb) to anon, authenticated;

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

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

drop policy if exists "Admins can manage support tickets" on public.support_tickets;
create policy "Admins can manage support tickets"
  on public.support_tickets
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can manage ticket messages" on public.support_ticket_messages;
create policy "Admins can manage ticket messages"
  on public.support_ticket_messages
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.support_tickets to authenticated;
grant select, insert, update, delete on public.support_ticket_messages to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'support_tickets'
  ) then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'support_ticket_messages'
  ) then
    alter publication supabase_realtime add table public.support_ticket_messages;
  end if;
exception when others then
  raise notice 'realtime publication skipped: %', sqlerrm;
end $$;
