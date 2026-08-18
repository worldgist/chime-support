update public.email_settings
set
  recipient = 'info@vasawealthearn.com',
  updated_at = now()
where id = 1;
