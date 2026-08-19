export const PAY_ANYONE_SUBJECT = 'You sent {{amount}} with Pay Anyone'

export const PAY_ANYONE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Way to pay!</title>
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
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin: 0 0 28px;
      padding: 8px 16px 8px 8px;
      background: #e8f8f2;
      border-radius: 999px;
      color: #0b3d2c;
      font-size: 16px;
      font-weight: 500;
    }
    .badge-icon {
      width: 42px;
      height: 42px;
      display: block;
    }
    .title {
      margin: 0 0 22px;
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
      margin: 36px 0 42px;
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
    .did-you-know {
      margin: 0 0 18px;
      font-size: 18px;
      line-height: 1.55;
      color: #102f25;
      text-align: left;
    }
    .steps {
      margin: 0;
      padding: 0;
      list-style: none;
      text-align: left;
    }
    .steps li {
      margin: 0 0 14px;
      font-size: 16px;
      line-height: 1.5;
      color: #102f25;
    }
    .footer {
      padding: 28px 36px 40px;
      color: #5b6f66;
      font-size: 13px;
      line-height: 1.5;
      text-align: left;
    }
    @media only screen and (max-width: 600px) {
      .header, .content, .footer { padding-left: 22px; padding-right: 22px; }
      .title { font-size: 34px; }
      .text, .did-you-know { font-size: 16px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="brand">chime</div>
    </div>
    <div class="content">
      <div class="badge">
        <svg class="badge-icon" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect width="56" height="56" rx="12" fill="#d8f5e6"/>
          <rect x="6" y="11" width="20" height="34" rx="7" fill="#7be3b0"/>
          <rect x="30" y="11" width="20" height="34" rx="7" fill="#4fd48f"/>
          <path d="M16 36c1.2-6 6.2-9.5 12-10.2 1.1-.1 2 .8 2 1.9V40c0 1.7-1.3 3-3 3h-5.2c-1.6 0-2.8-1.4-2.6-3L16 36z" fill="#f3d2b3"/>
          <path d="M40 36c-1.2-6-6.2-9.5-12-10.2-1.1-.1-2 .8-2 1.9V40c0 1.7 1.3 3 3 3h5.2c1.6 0 2.8-1.4 2.6-3L40 36z" fill="#e8c09a"/>
          <circle cx="28" cy="22" r="8" fill="#f0c014"/>
          <circle cx="28" cy="22" r="6.2" fill="#ffd84d"/>
          <path d="M28.7 18.6h-1.5v1.2c-1.5.2-2.5 1.1-2.5 2.4 0 1.4 1.1 2.1 2.8 2.4l.2.05c.9.16 1.2.4 1.2.8 0 .5-.5.8-1.4.8-.8 0-1.3-.3-1.5-.8l-1.4.4c.4 1.1 1.5 1.8 2.9 1.95V29.4h1.5v-1.2c1.5-.2 2.6-1.2 2.6-2.6 0-1.5-1.2-2.2-2.9-2.5l-.2-.04c-.8-.14-1.2-.36-1.2-.76 0-.45.45-.76 1.3-.76.7 0 1.15.28 1.3.7l1.35-.45c-.35-1-1.4-1.7-2.65-1.85v-1.04z" fill="#c98900"/>
        </svg>
        Pay Anyone
      </div>
      <h1 class="title">Way to pay!</h1>
      <p class="text">
        Hi <span class="emphasis">{{first_name}}</span>, you just sent
        <span class="emphasis">{{amount}}</span>
        for "{{memo}}" to
        <span class="emphasis">{{payee_name}}</span>.
      </p>
      <p class="text">You can view details about this transaction in the Chime app.</p>
      <div class="cta-wrap">
        <a class="cta" href="{{app_url}}" target="_blank" rel="noopener noreferrer">{{link_label}}</a>
      </div>
      <p class="did-you-know">
        Did you know you can pay people who don't have a Chime account? Here's how it works:
      </p>
      <ol class="steps">
        <li>Send money with an email address or mobile number.</li>
        <li>They get a link to collect the payment.</li>
        <li>The money is deposited to their debit card or bank account.</li>
      </ol>
    </div>
    <div class="footer">
      © {{year}} {{brand_name}}. This email was sent because you have an account with {{brand_name}}.
    </div>
  </div>
</body>
</html>
`
