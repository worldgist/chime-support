import { supabase } from '../lib/supabase'

export function formatEmailStamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function mapEmailNotification(row) {
  return {
    id: row.id,
    type: row.type || 'system',
    event: row.event || undefined,
    from: row.from_label || row.from,
    to: row.to_label || row.to || '',
    toAll: Boolean(row.to_all ?? row.toAll),
    recipients: Array.isArray(row.recipients) ? row.recipients : [],
    subject: row.subject || '',
    preview: row.preview || '',
    body: row.body || '',
    href: row.href || '/admin/notifications',
    time: row.created_at || row.time ? formatEmailStamp(row.created_at || row.time) : '',
    read: Boolean(row.is_read ?? row.read),
    direction: row.direction || 'in',
    deliveryStatus: row.delivery_status || row.deliveryStatus || 'pending',
    deliveryError: row.delivery_error || row.deliveryError || '',
    resendId: row.resend_id || row.resendId || '',
    sentAt: row.sent_at ? formatEmailStamp(row.sent_at) : '',
  }
}

export function mapEmailTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    desc: row.description || row.desc || '',
    subject: row.subject,
    snippet: row.snippet || '',
    body: row.body || '',
    cta: row.cta || '',
    icon: row.icon || 'mail',
    tone: row.tone || 'green',
    status: row.status || 'active',
    updated: formatEmailStamp(row.updated_at) || row.updated || '',
    by: row.updated_by || row.by || 'Admin',
  }
}

export function mapEmailSettings(row) {
  return {
    recipient: row.recipient,
    chatMessages: false,
    kycPending: row.kyc_pending,
    kycDecisions: row.kyc_decisions,
  }
}

export async function fetchAdminEmails() {
  const { data, error } = await supabase
    .from('email_notifications')
    .select('*')
    .eq('audience', 'admin')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data || []).map(mapEmailNotification).filter((item) => item.type !== 'chat')
}

export async function fetchEmailTemplates() {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapEmailTemplate)
}

export async function fetchEmailSettings() {
  const { data, error } = await supabase.from('email_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return data ? mapEmailSettings(data) : null
}

export async function saveEmailSettings(settings) {
  const { data, error } = await supabase
    .from('email_settings')
    .update({
      recipient: settings.recipient,
      chat_messages: false,
      kyc_pending: settings.kycPending,
      kyc_decisions: settings.kycDecisions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select('*')
    .single()
  if (error) throw error
  return mapEmailSettings(data)
}

function toRow(email, audience) {
  return {
    type: email.type || 'system',
    event: email.event || null,
    direction: email.direction || 'in',
    audience,
    from_label: email.from,
    to_label: email.to || null,
    to_all: Boolean(email.toAll),
    recipients: email.recipients || [],
    subject: email.subject,
    preview: email.preview || '',
    body: email.body || '',
    href: email.href || '/admin/notifications',
    is_read: Boolean(email.read),
    delivery_status: email.deliveryStatus || 'pending',
    delivery_error: email.deliveryError || null,
    resend_id: email.resendId || null,
  }
}

export async function insertEmailNotification(email, audience) {
  const { data, error } = await supabase
    .from('email_notifications')
    .insert(toRow(email, audience))
    .select('*')
    .single()
  if (error) throw error
  return mapEmailNotification(data)
}

export async function createAdminAlert(email) {
  const { data, error } = await supabase.rpc('create_admin_alert', {
    p_type: email.type || 'system',
    p_subject: email.subject || 'Notification',
    p_preview: email.preview || '',
    p_body: email.body || '',
    p_href: email.href || '/admin/notifications',
    p_event: email.event || null,
  })
  if (error) throw error
  return mapEmailNotification(data)
}

export async function dispatchEmailDelivery(notificationId) {
  if (!notificationId) return { ok: false, error: 'Missing notification id.' }
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  const { data, error } = await supabase.functions.invoke('send-email-notification', {
    body: { notificationId },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!error) {
    if (data?.ok === false || data?.error) {
      return { ok: false, error: data.error || 'Send failed' }
    }
    return data || { ok: true }
  }
  let message = error.message || 'Send failed'
  if (/not found|404/i.test(message)) {
    message = 'Email function is not deployed. Deploy send-email-notification in Supabase.'
  }
  if (error.context) {
    try {
      const body = await error.context.json()
      message = body?.error || message
      return { ok: false, error: message, details: body }
    } catch {
      // keep message
    }
  }
  return { ok: false, error: message }
}

export async function markEmailRead(id, isRead = true) {
  const { error } = await supabase.from('email_notifications').update({ is_read: isRead }).eq('id', id)
  if (error) throw error
}

export async function markAdminEmailsRead() {
  const { error } = await supabase
    .from('email_notifications')
    .update({ is_read: true })
    .eq('audience', 'admin')
    .eq('direction', 'in')
    .eq('is_read', false)
  if (error) throw error
}

export async function deleteEmailNotification(id) {
  const { error } = await supabase.from('email_notifications').delete().eq('id', id)
  if (error) throw error
}

export async function fetchCustomerEmails(email) {
  const { data, error } = await supabase.rpc('get_customer_emails', { p_email: email })
  if (error) throw error
  return (Array.isArray(data) ? data : []).map(mapEmailNotification)
}

export async function markCustomerEmailRead(id, email) {
  const { error } = await supabase.rpc('mark_customer_email_read', { p_id: id, p_email: email })
  if (error) throw error
}

function templateSlug(name) {
  return (
    String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || `tpl-${Date.now()}`
  )
}

export async function saveEmailTemplate(template, by = 'Admin') {
  const row = {
    id: template.id || templateSlug(template.name),
    name: template.name.trim(),
    description: template.desc || template.description || '',
    subject: template.subject.trim(),
    snippet: template.snippet || template.preview || '',
    body: template.body || '',
    cta: template.cta || '',
    icon: template.icon || 'mail',
    tone: template.tone || 'green',
    status: template.status === 'inactive' ? 'inactive' : 'active',
    updated_by: by,
    updated_at: new Date().toISOString(),
  }
  if (!row.name || !row.subject) throw new Error('Enter a template name and subject.')
  const { data, error } = await supabase.from('email_templates').upsert(row).select('*').single()
  if (error) throw error
  return mapEmailTemplate(data)
}

export async function deleteEmailTemplate(id) {
  const { error } = await supabase.from('email_templates').delete().eq('id', id)
  if (error) throw error
}
