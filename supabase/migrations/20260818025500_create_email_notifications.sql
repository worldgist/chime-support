create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'system' check (type in ('chat', 'kyc', 'system', 'outbound')),
  event text,
  direction text not null default 'in' check (direction in ('in', 'out')),
  audience text not null default 'admin' check (audience in ('admin', 'customer')),
  from_label text not null,
  to_label text,
  to_all boolean not null default false,
  recipients jsonb not null default '[]'::jsonb,
  subject text not null,
  preview text not null default '',
  body text not null default '',
  href text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists email_notifications_created_idx
  on public.email_notifications (created_at desc);
create index if not exists email_notifications_audience_idx
  on public.email_notifications (audience, created_at desc);
create index if not exists email_notifications_unread_idx
  on public.email_notifications (audience, is_read, created_at desc);

create table if not exists public.email_settings (
  id integer primary key default 1 check (id = 1),
  recipient text not null default 'alerts@chimesupport.local',
  chat_messages boolean not null default true,
  kyc_pending boolean not null default true,
  kyc_decisions boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.email_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.email_templates (
  id text primary key,
  name text not null,
  description text,
  subject text not null,
  snippet text,
  body text not null default '',
  cta text,
  icon text,
  tone text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.email_templates
  (id, name, description, subject, snippet, body, cta, icon, tone, status, updated_by, updated_at)
values
  (
    'welcome',
    'Welcome Email',
    'Sent to new users',
    'Welcome to Chime! 🎉',
    'Hi {{user_name}}, your account is ready.',
    $b$Welcome to Chime, {{user_name}}!

Your account is set up and ready. Move money, pay bills, and get support 24/7.

Get Started$b$,
    'Get Started',
    'mail',
    'green',
    'active',
    'Admin User',
    '2026-03-12 00:00:00+00'
  ),
  (
    'reset',
    'Password Reset',
    'Sent when a user requests a reset',
    'Reset your Chime password',
    'Use this link to choose a new password.',
    $b$Hi {{user_name}},

We received a request to reset your password. If this was you, continue with the secure link.$b$,
    'Reset Password',
    'lock',
    'blue',
    'active',
    'Admin User',
    '2026-03-10 00:00:00+00'
  ),
  (
    'txn',
    'Transaction Alert',
    'Sent after a debit or credit',
    'You spent {{amount}}',
    'A {{amount}} transaction posted to your account.',
    $b$Hi {{user_name}},

A transaction of {{amount}} was posted to your Chime account. If this was not you, contact support.$b$,
    'View Activity',
    'card',
    'navy',
    'active',
    'Jordan Lee',
    '2026-03-08 00:00:00+00'
  ),
  (
    'security',
    'Security Alert',
    'Sent after a new sign-in',
    'New sign-in to your Chime account',
    'We noticed a new sign-in on your account.',
    $b$Hi {{user_name}},

A new sign-in was detected. If this was not you, freeze your card and contact Chime Support.$b$,
    'Review Security',
    'shield',
    'red',
    'active',
    'Admin User',
    '2026-03-07 00:00:00+00'
  ),
  (
    'verified',
    'Account Verified',
    'Sent after KYC approval',
    'Your identity verification is complete',
    'Your documents were approved.',
    $b$Hi {{user_name}},

Your identity documents were reviewed and approved. You can keep using your Chime account as usual.$b$,
    'Go to Account',
    'users',
    'teal',
    'active',
    'Priya Nair',
    '2026-03-05 00:00:00+00'
  ),
  (
    'failed',
    'Payment Failed',
    'Sent when a payment cannot be processed',
    'Your payment of {{amount}} could not be processed',
    'Reason: {{reason}}',
    $b$Hi {{user_name}},

Your payment of {{amount}} could not be processed. Reason: {{reason}}.$b$,
    'Try Again',
    'card',
    'orange',
    'inactive',
    'Admin User',
    '2026-02-28 00:00:00+00'
  ),
  (
    'refund',
    'Payment Refund',
    'Sent when a payment is refunded',
    'Your refund of {{amount}} is on the way',
    '{{amount}} is being returned to your Chime account.',
    $b$Hi {{user_name}},

A refund of {{amount}} has been issued to your Chime account. Reason: {{reason}}.

It may take a few business days to appear in your available balance.$b$,
    'View Refund',
    'swap',
    'green',
    'active',
    'Admin User',
    '2026-08-17 00:00:00+00'
  ),
  (
    'referral',
    'Referral Bonus',
    'Sent when a referral completes',
    'Your Chime referral bonus is here',
    'You earned a bonus for inviting a friend.',
    $b$Hi {{user_name}},

Your referral bonus has been added to your account. Keep sharing Chime with friends.$b$,
    'See Bonus',
    'gift',
    'purple',
    'active',
    'Admin User',
    '2026-02-21 00:00:00+00'
  ),
  (
    'product',
    'Product Update',
    'Sent for feature announcements',
    'New on Chime this month',
    'See what is new in the app.',
    $b$Hi {{user_name}},

Here is what is new on Chime this month, including support chat and document uploads.$b$,
    'Learn More',
    'spark',
    'lime',
    'inactive',
    'Marcus Hale',
    '2026-02-14 00:00:00+00'
  )
on conflict (id) do nothing;

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

create or replace function public.get_customer_emails(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(coalesce(p_email, '')));
  result jsonb;
begin
  if position('@' in normalized) = 0 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(item) order by item.created_at desc), '[]'::jsonb)
  into result
  from (
    select *
    from public.email_notifications
    where audience = 'customer'
      and (
        to_all
        or lower(coalesce(to_label, '')) = normalized
        or exists (
          select 1
          from jsonb_array_elements(recipients) as recipient
          where lower(recipient->>'email') = normalized
        )
      )
    order by created_at desc
    limit 50
  ) item;

  return result;
end;
$$;

create or replace function public.mark_customer_email_read(p_id uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(coalesce(p_email, '')));
  updated integer;
begin
  update public.email_notifications
  set is_read = true
  where id = p_id
    and audience = 'customer'
    and (
      to_all
      or lower(coalesce(to_label, '')) = normalized
      or exists (
        select 1
        from jsonb_array_elements(recipients) as recipient
        where lower(recipient->>'email') = normalized
      )
    );

  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

grant execute on function public.get_customer_emails(text) to anon, authenticated;
grant execute on function public.mark_customer_email_read(uuid, text) to anon, authenticated;

alter table public.email_notifications enable row level security;
alter table public.email_settings enable row level security;
alter table public.email_templates enable row level security;

drop policy if exists "Admins can manage email notifications" on public.email_notifications;
create policy "Admins can manage email notifications"
  on public.email_notifications
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can manage email settings" on public.email_settings;
create policy "Admins can manage email settings"
  on public.email_settings
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can manage email templates" on public.email_templates;
create policy "Admins can manage email templates"
  on public.email_templates
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.email_notifications to authenticated;
grant select, insert, update, delete on public.email_settings to authenticated;
grant select, insert, update, delete on public.email_templates to authenticated;
grant all on public.email_notifications to service_role;
grant all on public.email_settings to service_role;
grant all on public.email_templates to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'email_notifications'
  ) then
    alter publication supabase_realtime add table public.email_notifications;
  end if;
exception when others then
  raise notice 'realtime publication skipped: %', sqlerrm;
end $$;
