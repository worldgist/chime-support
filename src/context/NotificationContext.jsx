import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadVisitor } from '../utils/chatStore'
import { CATALOG_TEMPLATES } from '../data/emailCatalog'
import { useAuth } from './AuthContext'
import { FROM_EMAIL } from '../utils/emailDelivery'
import {
  createAdminAlert,
  deleteEmailNotification,
  deleteEmailTemplate,
  dispatchEmailDelivery,
  fetchAdminEmails,
  fetchCustomerEmails,
  fetchEmailSettings,
  fetchEmailTemplates,
  insertEmailNotification,
  markAdminEmailsRead,
  markCustomerEmailRead,
  markEmailRead,
  saveEmailSettings,
  saveEmailTemplate,
} from '../utils/emailNotifications'

const NotificationContext = createContext(null)
const EMAILS_KEY = 'chime-admin-emails'
const USER_EMAILS_KEY = 'chime-user-emails'
const SETTINGS_KEY = 'chime-admin-email-settings'

export const LIVE_CUSTOMER_EMAIL = 'guest@chimesupport.local'

const defaultSettings = {
  recipient: FROM_EMAIL,
  chatMessages: true,
  kycPending: true,
  kycDecisions: true,
}

export const EMAIL_TEMPLATES = [
  {
    id: 'custom',
    label: 'Custom message',
    subject: '',
    body: '',
  },
  {
    id: 'follow-up',
    label: 'Chat follow-up',
    subject: 'We replied to your Chime Support chat',
    body: 'Hi {name},\n\nA Chime Support specialist has replied to your conversation. Open chat anytime to continue.\n\nThank you,\nChime Support',
  },
  {
    id: 'kyc-ok',
    label: 'KYC approved',
    subject: 'Your identity verification is complete',
    body: 'Hi {name},\n\nYour identity documents were reviewed and approved. You can keep using your Chime account as usual.\n\nThank you,\nChime Support',
  },
  {
    id: 'kyc-more',
    label: 'KYC needs more info',
    subject: 'We need another document to finish verification',
    body: 'Hi {name},\n\nWe could not finish your identity check yet. Please upload a clearer photo ID or a proof of address from the last 90 days.\n\nThank you,\nChime Support',
  },
  {
    id: 'account',
    label: 'Account update',
    subject: 'An update on your Chime account',
    body: 'Hi {name},\n\nWe wanted to let you know there is an update on your account. If you have questions, reply in Chime Support chat — we are here 24/7.\n\nThank you,\nChime Support',
  },
]

const seedEmails = [
  {
    id: 'mail-1',
    type: 'chat',
    from: 'Chime Chat <noreply@chimesupport.local>',
    subject: 'New live customer message',
    preview: 'Hi, I have a question about a recent transaction on my account.',
    body: 'A customer just sent a message in Live chat.\n\n“Hi, I have a question about a recent transaction on my account.”\n\nOpen Admin Chat Support to reply.',
    href: '/admin/tickets',
    time: 'Today, 10:31 AM',
    read: false,
  },
  {
    id: 'mail-2',
    type: 'kyc',
    event: 'queue',
    from: 'Chime KYC <kyc@chimesupport.local>',
    subject: 'KYC application needs review — Ava Chen',
    preview: 'Ava Chen submitted identity documents and is waiting for review.',
    body: 'A new KYC application is pending.\n\nCustomer: Ava Chen\nEmail: ava.chen@email.com\nRisk: low\n\nReview documents in KYC Management.',
    href: '/admin/kyc',
    time: 'Today, 8:14 AM',
    read: false,
  },
  {
    id: 'mail-3',
    type: 'kyc',
    event: 'queue',
    from: 'Chime KYC <kyc@chimesupport.local>',
    subject: 'KYC flagged for manual review — Marcus Hale',
    preview: 'Selfie mismatch and expired proof of address.',
    body: 'A KYC case was moved to manual review.\n\nCustomer: Marcus Hale\nFlags: selfie mismatch, expired address document\n\nOpen KYC Management to decide.',
    href: '/admin/kyc',
    time: 'Today, 7:48 AM',
    read: true,
  },
  {
    id: 'mail-4',
    type: 'system',
    from: 'Chime Support <alerts@chimesupport.local>',
    subject: 'Daily support digest',
    preview: '3 open chats and 2 KYC items waiting.',
    body: 'Here is your daily admin digest.\n\n• 3 open customer chats\n• 2 KYC applications waiting\n• Live customer chat is active\n\nThis is a UI preview of admin email notifications.',
    href: '/admin/notifications',
    time: 'Yesterday',
    read: true,
    direction: 'in',
  },
]

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function stamp() {
  return new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function showToast(setToast, email, duration = 4200) {
  setToast(email)
  window.setTimeout(() => setToast((current) => (current?.id === email.id ? null : current)), duration)
}

export function NotificationProvider({ children }) {
  const { isAuthenticated, ready, admin } = useAuth()
  const usingSupabase = Boolean(supabase)
  const [emails, setEmails] = useState(() => {
    if (usingSupabase) return []
    const stored = loadJson(EMAILS_KEY, null)
    return Array.isArray(stored) && stored.length ? stored : seedEmails
  })
  const [userEmails, setUserEmails] = useState(() => (usingSupabase ? [] : loadJson(USER_EMAILS_KEY, [])))
  const [templates, setTemplates] = useState(CATALOG_TEMPLATES)
  const [settings, setSettings] = useState(() => ({
    ...defaultSettings,
    ...loadJson(SETTINGS_KEY, {}),
  }))
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(usingSupabase)
  const [error, setError] = useState('')
  const skipSave = useRef(true)
  const emailsRef = useRef(emails)
  const settingsRef = useRef(settings)
  emailsRef.current = emails
  settingsRef.current = settings

  async function refreshAdminInbox() {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      setLoading(false)
      return
    }
    const [nextEmails, nextTemplates, nextSettings] = await Promise.all([
      fetchAdminEmails(),
      fetchEmailTemplates(),
      fetchEmailSettings(),
    ])
    setEmails(nextEmails)
    if (nextTemplates.length) setTemplates(nextTemplates)
    if (nextSettings) setSettings((current) => ({ ...current, ...nextSettings }))
    setError('')
    setLoading(false)
  }

  async function refreshCustomerInbox() {
    if (!supabase) return
    const visitor = loadVisitor()
    if (!visitor?.email) return
    const next = await fetchCustomerEmails(visitor.email)
    setUserEmails(next)
  }

  useEffect(() => {
    if (!supabase) return undefined
    let cancelled = false

    async function loadAdmin() {
      if (!ready || !isAuthenticated) {
        if (ready) setLoading(false)
        return
      }
      try {
        if (!cancelled) await refreshAdminInbox()
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || 'Could not load email notifications.')
          setLoading(false)
        }
      }
    }

    async function loadCustomer() {
      try {
        if (!cancelled) await refreshCustomerInbox()
      } catch {
        // Visitor inbox is optional until a chat session exists.
      }
    }

    loadAdmin()
    loadCustomer()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadAdmin()
    })
    const realtime = supabase
      .channel('email-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_notifications' }, () => {
        loadAdmin()
        loadCustomer()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_templates' }, loadAdmin)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_settings' }, loadAdmin)
      .subscribe()
    const poll = window.setInterval(() => {
      loadAdmin()
      loadCustomer()
    }, 8000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      supabase.removeChannel(realtime)
      data.subscription.unsubscribe()
    }
  }, [ready, isAuthenticated])

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    if (usingSupabase) return
    localStorage.setItem(EMAILS_KEY, JSON.stringify(emails.slice(0, 50)))
  }, [emails, usingSupabase])

  useEffect(() => {
    if (usingSupabase) return
    localStorage.setItem(USER_EMAILS_KEY, JSON.stringify(userEmails.slice(0, 50)))
  }, [userEmails, usingSupabase])

  useEffect(() => {
    if (usingSupabase) return
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings, usingSupabase])

  useEffect(() => {
    if (usingSupabase) return undefined
    function onStorage(event) {
      if (event.key === EMAILS_KEY && event.newValue) {
        try {
          const next = JSON.parse(event.newValue)
          if (!Array.isArray(next)) return
          const newest = next[0]
          const currentFirst = emailsRef.current[0]
          if (newest && newest.id !== currentFirst?.id && !newest.read) {
            showToast(setToast, newest)
          }
          skipSave.current = true
          setEmails(next)
        } catch {
          // ignore
        }
      }
      if (event.key === USER_EMAILS_KEY && event.newValue) {
        try {
          const next = JSON.parse(event.newValue)
          if (Array.isArray(next)) setUserEmails(next)
        } catch {
          // ignore
        }
      }
      if (event.key === SETTINGS_KEY && event.newValue) {
        try {
          setSettings({ ...defaultSettings, ...JSON.parse(event.newValue) })
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [usingSupabase])

  function allowed(email) {
    const current = settingsRef.current
    if (email.type === 'system') return true
    if (email.type === 'chat') return current.chatMessages
    if (email.type === 'kyc' && email.event === 'decision') return current.kycDecisions
    if (email.type === 'kyc') return current.kycPending
    return true
  }

  async function pushEmail(partial) {
    const email = {
      id: `mail-${Date.now()}`,
      type: 'system',
      from: `Chime Support <${FROM_EMAIL}>`,
      to: settingsRef.current.recipient,
      time: stamp(),
      read: false,
      direction: 'in',
      href: '/admin/notifications',
      preview: '',
      body: '',
      subject: 'Notification',
      ...partial,
    }
    if (!allowed(email)) return null

    if (supabase) {
      try {
        const saved = await createAdminAlert(email)
        dispatchEmailDelivery(saved.id).catch(() => {})
        setEmails((current) => [saved, ...current.filter((item) => item.id !== saved.id)].slice(0, 50))
        showToast(setToast, saved)
        return saved
      } catch {
        return null
      }
    }

    setEmails((current) => [email, ...current].slice(0, 50))
    showToast(setToast, email)
    return email
  }

  async function sendToUsers({ recipients = [], toAll = false, subject, body, fromName = 'Chime Support' }) {
    const trimmedSubject = subject.trim()
    const trimmedBody = body.trim()
    if (!trimmedSubject || !trimmedBody) return null
    if (!toAll && recipients.length === 0) return null

    const toLabel = toAll ? 'All customers' : recipients.map((item) => item.email).join(', ')
    const sent = {
      id: `mail-${Date.now()}`,
      type: 'outbound',
      direction: 'out',
      from: `${fromName} <${FROM_EMAIL}>`,
      to: toLabel,
      recipients,
      toAll,
      subject: trimmedSubject,
      preview: trimmedBody.slice(0, 90),
      body: trimmedBody,
      time: stamp(),
      read: true,
      href: '/admin/notifications',
    }
    const userCopy = { ...sent, id: `user-${Date.now()}`, read: false }

    if (supabase) {
      try {
        const customerCopy = await insertEmailNotification(userCopy, 'customer')
        const delivery = await dispatchEmailDelivery(customerCopy.id)
        const failed = delivery && delivery.ok === false
        const adminCopy = await insertEmailNotification(
          {
            ...sent,
            deliveryStatus: failed ? 'failed' : delivery?.skipped ? 'skipped' : 'sent',
            deliveryError: failed ? delivery.error : '',
            resendId: delivery?.id || '',
            read: true,
          },
          'admin',
        )
        setEmails((current) => [adminCopy, ...current.filter((item) => item.id !== adminCopy.id)].slice(0, 50))
        setUserEmails((current) => [customerCopy, ...current.filter((item) => item.id !== customerCopy.id)].slice(0, 50))
        showToast(setToast, {
          ...adminCopy,
          subject: failed ? `Send failed: ${trimmedSubject}` : `Sent: ${trimmedSubject}`,
          preview: failed ? delivery.error : `Delivered to ${toLabel}`,
        })
        return {
          ...adminCopy,
          deliveryStatus: failed ? 'failed' : 'sent',
          deliveryError: failed ? delivery.error : '',
        }
      } catch (sendError) {
        return { deliveryStatus: 'failed', deliveryError: sendError.message || 'Could not send that email.' }
      }
    }

    setEmails((current) => [sent, ...current].slice(0, 50))
    setUserEmails((current) => [userCopy, ...current].slice(0, 50))
    showToast(setToast, {
      ...sent,
      subject: `Sent: ${trimmedSubject}`,
      preview: `Delivered to ${toLabel}`,
    })
    return sent
  }

  async function markUserRead(id) {
    setUserEmails((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)))
    if (supabase) {
      const visitor = loadVisitor()
      if (visitor?.email) markCustomerEmailRead(id, visitor.email).catch(() => {})
    }
  }

  async function markRead(id) {
    setEmails((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)))
    if (supabase) markEmailRead(id).catch(() => {})
  }

  async function markAllRead() {
    setEmails((current) =>
      current.map((item) => (item.direction === 'out' ? item : { ...item, read: true })),
    )
    if (supabase) markAdminEmailsRead().catch(() => {})
  }

  async function retryDelivery(id) {
    const result = await dispatchEmailDelivery(id)
    if (supabase) {
      try {
        const next = await fetchAdminEmails()
        setEmails(next)
      } catch {
        // keep current list
      }
    }
    return result
  }

  async function removeEmail(id) {
    setEmails((current) => current.filter((item) => item.id !== id))
    if (supabase) deleteEmailNotification(id).catch(() => {})
  }

  async function updateSettings(patch) {
    const next = { ...settingsRef.current, ...patch }
    setSettings(next)
    if (!supabase) return { ok: true }
    try {
      const saved = await saveEmailSettings(next)
      setSettings((current) => ({ ...current, ...saved }))
      return { ok: true }
    } catch (saveError) {
      return { ok: false, error: saveError.message || 'Could not save email settings.' }
    }
  }

  async function upsertTemplate(template) {
    if (supabase) {
      try {
        const saved = await saveEmailTemplate(template, admin?.name || 'Admin')
        setTemplates((current) => {
          const rest = current.filter((item) => item.id !== saved.id)
          return [saved, ...rest]
        })
        return { ok: true, template: saved }
      } catch (saveError) {
        return { ok: false, error: saveError.message || 'Could not save that template.' }
      }
    }
    const local = {
      ...template,
      id: template.id || `tpl-${Date.now()}`,
      status: template.status || 'active',
      updated: stamp(),
      by: admin?.name || 'Admin',
    }
    setTemplates((current) => {
      const rest = current.filter((item) => item.id !== local.id)
      return [local, ...rest]
    })
    return { ok: true, template: local }
  }

  async function removeTemplate(id) {
    if (supabase) {
      try {
        await deleteEmailTemplate(id)
      } catch (deleteError) {
        return { ok: false, error: deleteError.message || 'Could not delete that template.' }
      }
    }
    setTemplates((current) => current.filter((item) => item.id !== id))
    return { ok: true }
  }

  async function toggleTemplateStatus(id) {
    const current = templates.find((item) => item.id === id)
    if (!current) return { ok: false, error: 'Template not found.' }
    return upsertTemplate({
      ...current,
      status: current.status === 'active' ? 'inactive' : 'active',
    })
  }

  const unreadCount = emails.filter((item) => !item.read && item.direction !== 'out').length
  const sentCount = emails.filter((item) => item.direction === 'out').length

  const value = useMemo(
    () => ({
      emails,
      userEmails,
      templates,
      settings,
      toast,
      unreadCount,
      sentCount,
      loading,
      error,
      usingSupabase,
      pushEmail,
      sendToUsers,
      markRead,
      markUserRead,
      markAllRead,
      retryDelivery,
      removeEmail,
      updateSettings,
      upsertTemplate,
      removeTemplate,
      toggleTemplateStatus,
      clearToast: () => setToast(null),
    }),
    [emails, userEmails, templates, settings, toast, unreadCount, sentCount, loading, error, usingSupabase],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used within NotificationProvider')
  return context
}
