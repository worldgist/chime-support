export const PAYMENT_PROCESSED_SUBJECT = 'Payment/Transfer Processed'

export const PAYMENT_PROCESSED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment/Transfer Processed</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #f4f6f5;
      font-family: Arial, Helvetica, sans-serif;
      color: #09291f;
    }
    .email-container {
      width: 100%;
      max-width: 680px;
      margin: 0 auto;
      background: #ffffff;
    }
    .header {
      margin: 20px 18px 0;
      padding: 35px 48px;
      background: #edf8f0;
    }
    .brand {
      font-size: 45px;
      font-weight: 600;
      color: #20c878;
      letter-spacing: -3px;
      line-height: 1;
    }
    .content { padding: 72px 48px 48px; }
    .title {
      margin: 0 0 52px;
      font-size: 58px;
      line-height: 1.04;
      letter-spacing: -2.5px;
      font-weight: 600;
      color: #06281d;
    }
    .text {
      margin: 0 0 28px;
      font-size: 25px;
      line-height: 1.55;
      color: #102f25;
      font-weight: 400;
    }
    .amount, .merchant, .balance { font-weight: 400; }
    .support-section { margin-top: 105px; }
    .support-link {
      color: #102f25;
      text-decoration: underline;
      font-weight: 500;
    }
    .heart {
      color: #24c978;
      font-size: 28px;
      vertical-align: middle;
    }
    .footer {
      background: #06291e;
      color: #ffffff;
      padding: 46px 48px 60px;
    }
    .footer-brand {
      color: #ffffff;
      font-size: 45px;
      font-weight: 600;
      letter-spacing: -3px;
      margin-bottom: 28px;
    }
    .socials {
      display: flex;
      align-items: center;
      gap: 28px;
      margin-bottom: 34px;
      font-size: 24px;
      font-weight: 500;
    }
    .footer-text {
      margin: 0 0 30px;
      color: #f5faf7;
      font-size: 18px;
      line-height: 1.55;
    }
    .footer-link {
      color: #d6f3df;
      text-decoration: underline;
      font-weight: 500;
    }
    @media only screen and (max-width: 600px) {
      .header { margin: 12px; padding: 28px 25px; }
      .brand { font-size: 40px; }
      .content { padding: 50px 26px 40px; }
      .title {
        font-size: 42px;
        line-height: 1.06;
        letter-spacing: -1.7px;
        margin-bottom: 40px;
      }
      .text { font-size: 20px; line-height: 1.55; }
      .support-section { margin-top: 70px; }
      .footer { padding: 38px 26px 48px; }
      .footer-brand { font-size: 40px; }
      .socials { gap: 24px; font-size: 22px; }
      .footer-text { font-size: 16px; line-height: 1.55; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="brand">chime</div>
    </div>
    <div class="content">
      <h1 class="title">Payment/Transfer<br>Processed</h1>
      <p class="text">Hi {{first_name}},</p>
      <p class="text">
        A payment or transfer of
        <span class="amount">{{amount}}</span>
        has been deducted from your
        {{account_name}}
        account by
        <span class="merchant">{{merchant_name}}</span>.
        Your updated balance is now
        <span class="balance">{{balance}}</span>.
      </p>
      <div class="support-section">
        <p class="text">
          If this was taken out in error or if you
          don't recognize this transaction, contact
          us through your account support channel.
        </p>
      </div>
      <p class="text">
        <span class="heart">♥</span>
        from {{brand_name}}
        <br>
        Questions? We're here to
        <a href="{{support_url}}" class="support-link" target="_blank" rel="noopener noreferrer">help</a>.
      </p>
    </div>
    <div class="footer">
      <div class="footer-brand">chime</div>
      <div class="socials">
        <span>◎</span>
        <span>𝕏</span>
        <span>♪</span>
        <span>f</span>
      </div>
      <p class="footer-text">© {{year}} {{brand_name}}. All Rights Reserved.</p>
      <p class="footer-text">
        {{brand_name}} and its associated
        trademarks and services are owned by
        {{company_name}}.
      </p>
      <p class="footer-text">Please do not reply to this email. This account isn't monitored.</p>
      <p class="footer-text">For more information about your account, please refer to your account agreement.</p>
      <p class="footer-text">This email was sent to you because you have an account with {{brand_name}}.</p>
    </div>
  </div>
</body>
</html>
`
