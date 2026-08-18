create table if not exists public.admin_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text,
  role text not null default 'admin' check (role in ('admin', 'super_admin')),
  created_at timestamptz not null default now()
);

create index if not exists admin_users_email_idx on public.admin_users (email);

alter table public.admin_users enable row level security;

create policy "Admin users can read own profile"
  on public.admin_users
  for select
  to authenticated
  using (auth.uid() = id);

grant select on public.admin_users to authenticated;
grant all on public.admin_users to service_role;
