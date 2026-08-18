create table if not exists public.kyc_cases (
  id uuid primary key default gen_random_uuid(),
  token uuid unique not null default gen_random_uuid(),
  link_status text not null default 'open' check (link_status in ('open', 'used', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  dob text,
  address text,
  ssn_last4 text,
  status text not null default 'awaiting'
    check (status in ('awaiting', 'pending', 'review', 'approved', 'rejected', 'more_info')),
  risk text not null default 'low' check (risk in ('low', 'medium', 'high')),
  country text not null default 'United States',
  source text not null default 'link',
  assigned_admin_id uuid references public.admin_users (id) on delete set null,
  notes jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kyc_cases_status_idx on public.kyc_cases (status);
create index if not exists kyc_cases_email_idx on public.kyc_cases (customer_email);
create index if not exists kyc_cases_token_idx on public.kyc_cases (token);
create index if not exists kyc_cases_created_idx on public.kyc_cases (created_at desc);

create table if not exists public.kyc_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.kyc_cases (id) on delete cascade,
  doc_type text not null check (doc_type in ('id-front', 'id-back', 'selfie', 'address')),
  label text not null,
  quality text not null default 'clear',
  image_data text,
  created_at timestamptz not null default now()
);

create index if not exists kyc_documents_case_idx on public.kyc_documents (case_id, created_at);

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

create or replace function public.touch_kyc_case()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kyc_cases_touch on public.kyc_cases;
create trigger kyc_cases_touch
  before update on public.kyc_cases
  for each row
  execute function public.touch_kyc_case();

create or replace function public.get_kyc_link(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.kyc_cases;
begin
  select * into row
  from public.kyc_cases
  where token = p_token;

  if row.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', row.id,
    'token', row.token,
    'name', row.customer_name,
    'email', row.customer_email,
    'phone', row.customer_phone,
    'status', row.status,
    'linkStatus', row.link_status,
    'expiresAt', row.expires_at,
    'submittedAt', row.submitted_at
  );
end;
$$;

create or replace function public.submit_kyc_verification(
  p_token uuid,
  p_ssn text,
  p_id_front text,
  p_id_back text,
  p_selfie text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.kyc_cases;
  digits text;
  last4 text;
  event jsonb;
begin
  select * into row
  from public.kyc_cases
  where token = p_token;

  if row.id is null then
    raise exception 'This verification link is not valid.';
  end if;

  if row.status in ('approved', 'rejected') then
    raise exception 'This verification has already been decided.';
  end if;

  if row.status = 'awaiting' and row.expires_at < now() then
    raise exception 'This verification link has expired.';
  end if;

  if row.status not in ('awaiting', 'more_info') then
    raise exception 'This verification has already been submitted.';
  end if;

  if coalesce(p_id_front, '') = '' or coalesce(p_id_back, '') = '' or coalesce(p_selfie, '') = '' then
    raise exception 'Add ID front, ID back, and a selfie to continue.';
  end if;

  digits := regexp_replace(coalesce(p_ssn, ''), '\D', '', 'g');
  if length(digits) <> 9 then
    raise exception 'Enter a 9-digit Social Security number.';
  end if;
  last4 := right(digits, 4);

  delete from public.kyc_documents where case_id = row.id;

  insert into public.kyc_documents (case_id, doc_type, label, quality, image_data)
  values
    (row.id, 'id-front', 'ID card — front', 'clear', p_id_front),
    (row.id, 'id-back', 'ID card — back', 'clear', p_id_back),
    (row.id, 'selfie', 'Live selfie', 'clear', p_selfie);

  event := jsonb_build_object(
    'id', extract(epoch from now())::bigint,
    'at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'text', 'Customer completed ID, SSN, and selfie verification',
    'by', row.customer_name
  );

  update public.kyc_cases
  set
    status = 'pending',
    link_status = 'used',
    ssn_last4 = last4,
    submitted_at = now(),
    history = coalesce(history, '[]'::jsonb) || jsonb_build_array(event)
  where id = row.id;

  return jsonb_build_object('ok', true, 'id', row.id);
end;
$$;

grant execute on function public.get_kyc_link(uuid) to anon, authenticated;
grant execute on function public.submit_kyc_verification(uuid, text, text, text, text) to anon, authenticated;

alter table public.kyc_cases enable row level security;
alter table public.kyc_documents enable row level security;

drop policy if exists "Admins can manage kyc cases" on public.kyc_cases;
create policy "Admins can manage kyc cases"
  on public.kyc_cases
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can manage kyc documents" on public.kyc_documents;
create policy "Admins can manage kyc documents"
  on public.kyc_documents
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.kyc_cases to authenticated;
grant select, insert, update, delete on public.kyc_documents to authenticated;
grant all on public.kyc_cases to service_role;
grant all on public.kyc_documents to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'kyc_cases'
  ) then
    alter publication supabase_realtime add table public.kyc_cases;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'kyc_documents'
  ) then
    alter publication supabase_realtime add table public.kyc_documents;
  end if;
exception when others then
  raise notice 'realtime publication skipped: %', sqlerrm;
end $$;
