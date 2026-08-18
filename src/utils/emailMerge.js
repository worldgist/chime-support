import { FROM_DOMAIN } from './emailDelivery'

export function firstName(name) {
  return String(name || 'there').trim().split(/\s+/)[0] || 'there'
}

export function defaultMergeValues(user = {}) {
  return {
    first_name: firstName(user.name),
    user_name: user.name || 'there',
    amount: user.amount || '$0.00',
    account_name: user.account_name || 'Chime',
    merchant_name: user.merchant_name || 'Merchant',
    balance: user.balance || '$0.00',
    memo: user.memo || user.reason || 'Payment',
    payee_name: user.payee_name || 'someone',
    app_url: user.app_url || `https://${FROM_DOMAIN}`,
    brand_name: 'Chime',
    company_name: 'Chime',
    support_url: `https://${FROM_DOMAIN}`,
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

export function isFullEmailDocument(value) {
  const raw = String(value || '').trim()
  return /^<!DOCTYPE html/i.test(raw) || /^<html[\s>]/i.test(raw)
}
