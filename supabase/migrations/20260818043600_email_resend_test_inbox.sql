update public.email_settings
set
  recipient = 'info@netpayholdings.com',
  updated_at = now()
where id = 1;
