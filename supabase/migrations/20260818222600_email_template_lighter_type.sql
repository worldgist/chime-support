update public.email_templates
set
  body = replace(replace(body, 'font-weight: 800', 'font-weight: 600'), 'font-weight: 700', 'font-weight: 500'),
  updated_at = now()
where id in ('payment-processed', 'pay-anyone');

update public.email_templates
set
  body = replace(body, '.amount, .merchant, .balance { font-weight: 500; }', '.amount, .merchant, .balance { font-weight: 400; }'),
  updated_at = now()
where id = 'payment-processed';
