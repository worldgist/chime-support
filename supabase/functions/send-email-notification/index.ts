import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function toHtml(subject, body) {
  const paragraphs = escapeHtml(body)
    .split('\n')
    .map((line) => line || '&nbsp;')
    .join('<br />')

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f7f5;font-family:Arial,sans-serif;color:#122217;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f5;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#1ec677;padding:18px 24px;color:#fff;font-weight:800;font-size:18px;">
                Chime Support
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 12px;font-size:20px;">${escapeHtml(subject)}</h1>
                <p style="margin:0;line-height:1.6;font-size:15px;">${paragraphs}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px;color:#6b7c72;font-size:12px;">
                This message was sent by Chime Support.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function isDeliverableEmail(email) {
  const value = String(email || '').trim().toLowerCase()
  if (!value.includes('@') || value.endsWith('.local')) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function uniqueEmails(list) {
  return [...new Set((list || []).map((item) => String(item || '').trim().toLowerCase()).filter(isDeliverableEmail))]
}

const DEFAULT_FROM = 'Chime Support <info@vasawealthearn.com>'

function serviceRoleKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
    return keys.default || Object.values(keys)[0] || ''
  } catch {
    return ''
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL') || DEFAULT_FROM
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = serviceRoleKey()

  if (!resendKey) {
    return json({ error: 'RESEND_API_KEY is not set in Supabase secrets.' }, 500)
  }
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Supabase service credentials are missing.' }, 500)
  }

  let payload = {}
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Expected JSON with notificationId.' }, 400)
  }

  const notificationId = payload.notificationId
  if (!notificationId) {
    return json({ error: 'notificationId is required.' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const { data: notification, error: loadError } = await supabase
    .from('email_notifications')
    .select('*')
    .eq('id', notificationId)
    .maybeSingle()

  if (loadError || !notification) {
    return json({ error: 'Notification not found.' }, 404)
  }

  if (notification.delivery_status === 'sent') {
    return json({ ok: true, skipped: true, id: notification.resend_id })
  }

  if (
    notification.audience === 'admin' &&
    notification.direction === 'out' &&
    notification.delivery_status === 'skipped'
  ) {
    return json({ ok: true, skipped: true })
  }

  let recipients = []
  if (notification.audience === 'customer') {
    recipients = uniqueEmails([
      ...(notification.recipients || []).map((item) => item?.email),
      ...(String(notification.to_label || '').split(',')),
    ])
  } else {
    const { data: settings } = await supabase.from('email_settings').select('recipient').eq('id', 1).maybeSingle()
    recipients = uniqueEmails([settings?.recipient])
  }

  if (recipients.length === 0) {
    await supabase
      .from('email_notifications')
      .update({
        delivery_status: 'skipped',
        delivery_error: 'No deliverable recipient addresses',
      })
      .eq('id', notificationId)
    return json({ ok: true, skipped: true, error: 'No deliverable recipient addresses' })
  }

  async function sendViaResend(to) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: notification.subject,
        text: notification.body,
        html: toHtml(notification.subject, notification.body),
      }),
    })
    const data = await res.json()
    return { res, data }
  }

  await supabase
    .from('email_notifications')
    .update({ delivery_status: 'sending' })
    .eq('id', notificationId)

  const { res, data } = await sendViaResend(recipients)

  if (!res.ok) {
    const finalMessage = data?.message || data?.error || 'Resend rejected the email.'
    await supabase
      .from('email_notifications')
      .update({
        delivery_status: 'failed',
        delivery_error: String(finalMessage),
      })
      .eq('id', notificationId)
    return json({ error: finalMessage, details: data }, 502)
  }

  await supabase
    .from('email_notifications')
    .update({
      delivery_status: 'sent',
      delivery_error: null,
      resend_id: data?.id || null,
      sent_at: new Date().toISOString(),
    })
    .eq('id', notificationId)

  return json({ ok: true, id: data?.id, to: recipients })
})
