update public.email_settings
set
  recipient = 'support@chaincola.com',
  updated_at = now()
where id = 1;
