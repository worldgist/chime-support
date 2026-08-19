insert into public.email_templates
  (id, name, description, subject, snippet, body, cta, icon, tone, status, updated_by, updated_at)
values
  (
    'refund-pending',
    'Refund Pending',
    'Sent when a refund needs customer service to complete',
    'Your {{amount}} refund is pending',
    'Your {{amount}} refund is currently pending.',
    $refundpending$<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refund Pending</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
      color: #06281d;
    }
    .email-container {
      width: 100%;
      max-width: 640px;
      margin: 0 auto;
      background: #ffffff;
    }
    .header {
      padding: 28px 36px;
      background: #e8f8f2;
    }
    .brand {
      font-size: 34px;
      font-weight: 600;
      color: #1ec677;
      letter-spacing: -1.8px;
      line-height: 1;
    }
    .content {
      padding: 42px 36px 28px;
    }
    .title {
      margin: 0 0 28px;
      font-size: 42px;
      line-height: 1.1;
      letter-spacing: -1.4px;
      font-weight: 600;
      color: #06281d;
    }
    .text {
      margin: 0 0 18px;
      font-size: 18px;
      line-height: 1.55;
      color: #102f25;
    }
    .emphasis {
      font-weight: 500;
    }
    .cta-wrap {
      margin: 32px 0 28px;
      text-align: center;
    }
    .cta {
      display: inline-block;
      background: #1ec677;
      color: #06281d !important;
      text-decoration: none;
      font-size: 18px;
      font-weight: 600;
      padding: 16px 28px;
      border-radius: 10px;
    }
    .footer {
      padding: 28px 36px 40px;
      color: #5b6f66;
      font-size: 13px;
      line-height: 1.5;
    }
    @media only screen and (max-width: 600px) {
      .header, .content, .footer { padding-left: 22px; padding-right: 22px; }
      .title { font-size: 34px; }
      .text { font-size: 16px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="brand">chime</div>
    </div>
    <div class="content">
      <h1 class="title">Refund Pending</h1>
      <p class="text">Hi {{first_name}},</p>
      <p class="text">
        Your <span class="emphasis">{{amount}} refund is currently pending</span>
        and requires additional assistance to be completed.
      </p>
      <p class="text">
        Please click the link below to
        <span class="emphasis">chat with Customer Service</span>
        and resolve the issue with your refund:
      </p>
      <div class="cta-wrap">
        <a class="cta" href="{{app_url}}" target="_blank" rel="noopener noreferrer">{{link_label}}</a>
      </div>
      <p class="text">
        Once the issue is resolved, your refund can proceed for processing.
      </p>
    </div>
    <div class="footer">
      © {{year}} {{brand_name}}. This email was sent because you have an account with {{brand_name}}.
    </div>
  </div>
</body>
</html>
$refundpending$,
    'Chat with Customer Service',
    'card',
    'orange',
    'active',
    'Admin User',
    now()
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  snippet = excluded.snippet,
  body = excluded.body,
  cta = excluded.cta,
  icon = excluded.icon,
  tone = excluded.tone,
  status = excluded.status,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at;
