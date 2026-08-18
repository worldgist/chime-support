create table if not exists public.workspace_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  status text not null default 'active' check (status in ('active', 'review', 'inactive')),
  source text not null default 'manual' check (source in ('manual', 'chat', 'kyc', 'admin')),
  admin_user_id uuid unique references public.admin_users (id) on delete set null,
  notes text,
  created_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_users_status_idx on public.workspace_users (status);
create index if not exists workspace_users_role_idx on public.workspace_users (role);
create index if not exists workspace_users_email_idx on public.workspace_users (email);
create index if not exists workspace_users_created_idx on public.workspace_users (created_at desc);

create or replace function public.touch_workspace_user()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.email = lower(trim(new.email));
  new.phone = nullif(trim(coalesce(new.phone, '')), '');
  new.name = trim(new.name);
  return new;
end;
$$;

drop trigger if exists workspace_users_touch on public.workspace_users;
create trigger workspace_users_touch
  before insert or update on public.workspace_users
  for each row
  execute function public.touch_workspace_user();

create or replace function public.sync_workspace_user(
  p_name text,
  p_email text,
  p_phone text default null,
  p_source text default 'manual'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(coalesce(p_email, '')));
  display_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  if position('@' in normalized) = 0 then
    return;
  end if;

  insert into public.workspace_users (name, email, phone, source)
  values (
    coalesce(display_name, split_part(normalized, '@', 1)),
    normalized,
    nullif(trim(coalesce(p_phone, '')), ''),
    case when p_source in ('manual', 'chat', 'kyc', 'admin') then p_source else 'manual' end
  )
  on conflict (email) do update
  set
    name = case
      when public.workspace_users.source = 'manual' then public.workspace_users.name
      else excluded.name
    end,
    phone = coalesce(nullif(excluded.phone, ''), public.workspace_users.phone),
    updated_at = now();
end;
$$;

create or replace function public.sync_workspace_user_from_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_workspace_user(
    new.customer_name,
    new.customer_email,
    new.customer_phone,
    'chat'
  );
  return new;
end;
$$;

drop trigger if exists support_tickets_sync_user on public.support_tickets;
create trigger support_tickets_sync_user
  after insert or update of customer_name, customer_email, customer_phone
  on public.support_tickets
  for each row
  execute function public.sync_workspace_user_from_ticket();

create or replace function public.sync_workspace_user_from_kyc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_workspace_user(
    new.customer_name,
    new.customer_email,
    new.customer_phone,
    'kyc'
  );
  return new;
end;
$$;

drop trigger if exists kyc_cases_sync_user on public.kyc_cases;
create trigger kyc_cases_sync_user
  after insert or update of customer_name, customer_email, customer_phone
  on public.kyc_cases
  for each row
  execute function public.sync_workspace_user_from_kyc();

insert into public.workspace_users (name, email, role, status, source, admin_user_id)
select
  coalesce(nullif(trim(name), ''), split_part(email, '@', 1)),
  lower(email),
  'admin',
  'active',
  'admin',
  id
from public.admin_users
on conflict (email) do update
set
  role = 'admin',
  source = 'admin',
  admin_user_id = excluded.admin_user_id,
  updated_at = now();

insert into public.workspace_users (name, email, phone, source)
select distinct on (lower(customer_email))
  customer_name,
  lower(customer_email),
  customer_phone,
  'chat'
from public.support_tickets
where position('@' in coalesce(customer_email, '')) > 0
order by lower(customer_email), last_activity_at desc
on conflict (email) do nothing;

insert into public.workspace_users (name, email, phone, source)
select distinct on (lower(customer_email))
  customer_name,
  lower(customer_email),
  customer_phone,
  'kyc'
from public.kyc_cases
where position('@' in coalesce(customer_email, '')) > 0
order by lower(customer_email), created_at desc
on conflict (email) do nothing;

drop policy if exists "Admin users can read own profile" on public.admin_users;
drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
  on public.admin_users
  for select
  to authenticated
  using (public.is_admin());

alter table public.workspace_users enable row level security;

drop policy if exists "Admins can manage workspace users" on public.workspace_users;
create policy "Admins can manage workspace users"
  on public.workspace_users
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant execute on function public.sync_workspace_user(text, text, text, text) to authenticated, service_role;
grant select, insert, update, delete on public.workspace_users to authenticated;
grant all on public.workspace_users to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'workspace_users'
  ) then
    alter publication supabase_realtime add table public.workspace_users;
  end if;
exception when others then
  raise notice 'realtime publication skipped: %', sqlerrm;
end $$;
