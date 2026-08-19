import { FROM_DOMAIN } from './emailDelivery'

export function firstName(name) {
  return String(name || 'there').trim().split(/\s+/)[0] || 'there'
}

export function normalizeHttpUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.toString()
  } catch {
    return ''
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function defaultMergeValues(user = {}) {
  const customLink = normalizeHttpUrl(user.link_url)
  const fallbackUrl = `https://${FROM_DOMAIN}`
  return {
    first_name: firstName(user.name),
    user_name: user.name || 'there',
    amount: user.amount || '$0.00',
    account_name: user.account_name || 'Chime',
    merchant_name: user.merchant_name || 'Merchant',
    balance: user.balance || '$0.00',
    memo: user.memo || user.reason || 'Payment',
    payee_name: user.payee_name || 'someone',
    link_url: user.link_url || '',
    link_label: user.link_label || 'Open link',
    app_url: customLink || user.app_url || fallbackUrl,
    brand_name: 'Chime',
    company_name: 'Chime',
    support_url: customLink || user.support_url || fallbackUrl,
    year: String(new Date().getFullYear()),
    reason: user.reason || '',
  }
}

export function applyEmailMerge(text, user = {}, { keep = [] } = {}) {
  const values = defaultMergeValues(user)
  const skip = new Set(keep)
  return String(text || '').replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (skip.has(key)) return match
    return values[key] != null && values[key] !== '' ? String(values[key]) : match
  })
}

export function attachEmailLink(body, { link_url, link_label } = {}) {
  const href = normalizeHttpUrl(link_url)
  if (!href) return String(body || '')
  if (/class="cta"/i.test(body) || /\{\{link_url\}\}/.test(body)) return String(body || '')

  const label = escapeHtml(String(link_label || 'Open link').trim() || 'Open link')
  const safeHref = escapeHtml(href)
  const block = `<div style="margin:28px 0 12px;text-align:center;"><a href="${safeHref}" style="display:inline-block;background:#1ec677;color:#06281d;text-decoration:none;font-weight:600;font-size:16px;padding:14px 24px;border-radius:10px;" target="_blank" rel="noopener noreferrer">${label}</a></div>`
  const raw = String(body || '')
  if (/<div class="footer"/i.test(raw)) {
    return raw.replace(/<div class="footer"/i, `${block}\n    <div class="footer"`)
  }
  if (/<\/body>/i.test(raw)) return raw.replace(/<\/body>/i, `${block}\n</body>`)
  return `${raw}\n${block}`
}

export function isFullEmailDocument(value) {
  const raw = String(value || '').trim()
  return /^<!DOCTYPE html/i.test(raw) || /^<html[\s>]/i.test(raw)
}

