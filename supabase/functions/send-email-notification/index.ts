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

function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''))
}

function isFullEmailDocument(value) {
  const raw = String(value || '').trim()
  return /^<!DOCTYPE html/i.test(raw) || /^<html[\s>]/i.test(raw)
}

function sanitizeHtml(raw) {
  return String(raw || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+=(?:"[^"]*"|'[^']*')/gi, '')
}

function toText(body) {
  return String(body || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function toHtml(subject, body) {
  const raw = String(body || '')
  if (isFullEmailDocument(raw)) return sanitizeHtml(raw)

  const inner = looksLikeHtml(raw)
    ? sanitizeHtml(raw)
    : escapeHtml(raw)
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
                <div style="margin:0;line-height:1.6;font-size:15px;">${inner}</div>
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

function mergeTokens(text, vars) {
  return String(text || '').replace(/\{\{(\w+)\}\}/g, (match, key) =>
    vars[key] != null && vars[key] !== '' ? String(vars[key]) : match,
  )
}

function firstName(name) {
  return String(name || 'there').trim().split(/\s+/)[0] || 'there'
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

  const listed = uniqueEmails([
    ...(notification.recipients || []).map((item) => (typeof item === 'string' ? item : item?.email)),
    ...(String(notification.to_label || '').split(',')),
  ])

  let recipients = listed
  if (notification.direction !== 'out' && notification.audience !== 'customer') {
    const { data: settings } = await supabase.from('email_settings').select('recipient').eq('id', 1).maybeSingle()
    recipients = uniqueEmails([settings?.recipient, ...listed])
  }

  if (recipients.length === 0) {
    await supabase
      .from('email_notifications')
      .update({
        delivery_status: 'failed',
        delivery_error: 'No deliverable recipient addresses',
      })
      .eq('id', notificationId)
    return json({ ok: false, error: 'No deliverable recipient addresses' }, 400)
  }

  function varsForEmail(email) {
    const rec = (notification.recipients || []).find((item) => {
      const value = typeof item === 'string' ? item : item?.email
      return String(value || '').trim().toLowerCase() === email
    })
    const name = typeof rec === 'object' ? rec?.name : ''
    return {
      first_name: firstName(name),
      user_name: name || 'there',
      brand_name: 'Chime',
      company_name: 'Chime',
      support_url: 'https://vasawealthearn.com',
      app_url: 'https://vasawealthearn.com',
      year: String(new Date().getFullYear()),
    }
  }

  async function sendViaResend(chunk, subject, body) {
    const mail = {
      from,
      to: chunk[0],
      subject,
      text: toText(body) || subject,
      html: toHtml(subject, body),
    }
    if (chunk.length > 1) mail.bcc = chunk.slice(1)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mail),
    })
    const data = await res.json()
    return { res, data }
  }

  await supabase
    .from('email_notifications')
    .update({ delivery_status: 'sending', delivery_error: null })
    .eq('id', notificationId)

  const needsPersonalize = /\{\{(first_name|user_name)\}\}/.test(`${notification.subject}\n${notification.body}`)
  const jobs = needsPersonalize
    ? recipients.map((email) => {
        const vars = varsForEmail(email)
        return {
          chunk: [email],
          subject: mergeTokens(notification.subject, vars),
          body: mergeTokens(notification.body, vars),
        }
      })
    : (() => {
        const batches = []
        for (let index = 0; index < recipients.length; index += 50) {
          batches.push({
            chunk: recipients.slice(index, index + 50),
            subject: notification.subject,
            body: notification.body,
          })
        }
        return batches
      })()

  const ids = []
  for (const job of jobs) {
    const { res, data } = await sendViaResend(job.chunk, job.subject, job.body)
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
    if (data?.id) ids.push(data.id)
  }

  await supabase
    .from('email_notifications')
    .update({
      delivery_status: 'sent',
      delivery_error: null,
      resend_id: ids[0] || null,
      sent_at: new Date().toISOString(),
    })
    .eq('id', notificationId)

  return json({ ok: true, id: ids[0] || null, to: recipients })
})
