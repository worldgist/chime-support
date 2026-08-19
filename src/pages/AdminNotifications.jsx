import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { useKyc } from '../context/KycContext'
import { useUsers } from '../context/UserContext'
import { useNotifications } from '../context/NotificationContext'
import { SendIcon } from '../components/icons'
import { IconSearch } from '../components/adminIcons'
import { applyEmailMerge, defaultMergeValues, isFullEmailDocument } from '../utils/emailMerge'

const MERGE_FIELD_META = [
  { key: 'amount', label: 'Amount' },
  { key: 'account_name', label: 'Account name' },
  { key: 'merchant_name', label: 'Merchant' },
  { key: 'balance', label: 'Updated balance' },
  { key: 'memo', label: 'Description' },
  { key: 'payee_name', label: 'Payee' },
]

function usedMergeFields(text) {
  return MERGE_FIELD_META.filter((field) => String(text || '').includes(`{{${field.key}}}`))
}

const AVATAR_COLORS = ['#16a34a', '#0f766e', '#2563eb', '#7c3aed', '#db2777', '#d97706']

function isRealEmail(email) {
  const value = String(email || '').trim().toLowerCase()
  return value.includes('@') && !value.endsWith('.local')
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U'
}

function avatarColor(value) {
  const text = String(value || '')
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash + text.charCodeAt(index) * (index + 1)) % AVATAR_COLORS.length
  }
  return AVATAR_COLORS[hash]
}

function formatStamp(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  return String(value)
}

function recipientEmails(item) {
  if (Array.isArray(item.recipients) && item.recipients.length) {
    return item.recipients.map((entry) => entry.email || entry).filter(Boolean)
  }
  return String(item.to || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function StatusIcon({ status }) {
  if (status === 'sent') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="m8 12 2.8 2.8L16 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (status === 'failed') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="m9 9 6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function deliveryLabel(status) {
  if (status === 'sent') return 'Sent'
  if (status === 'failed') return 'Failed'
  if (status === 'skipped') return 'Failed'
  if (status === 'sending') return 'Pending'
  return 'Pending'
}

function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''))
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function previewHtml(body) {
  const raw = String(body || '')
  if (!raw.trim()) return '<p>Your message preview will appear here.</p>'
  if (looksLikeHtml(raw)) {
    return raw
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+=(?:"[^"]*"|'[^']*')/gi, '')
  }
  return `<p>${escapeHtml(raw).replace(/\n/g, '<br />')}</p>`
}

export default function AdminNotifications() {
  const { admin } = useAuth()
  const { conversations } = useChat()
  const { cases } = useKyc()
  const { users: directory } = useUsers()
  const { emails, templates, sendToUsers, retryDelivery, loading, error: loadError, usingSupabase } = useNotifications()
  const [params] = useSearchParams()
  const presetEmail = String(params.get('email') || '').trim().toLowerCase()

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [mergeFields, setMergeFields] = useState(() => defaultMergeValues())
  const [audience, setAudience] = useState(presetEmail ? 'specific' : 'all')
  const [selected, setSelected] = useState([])
  const [query, setQuery] = useState('')
  const [sending, setSending] = useState(false)
  const [retryingId, setRetryingId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(() => new Date())

  const users = useMemo(() => {
    const list = [
      ...directory.map((item) => ({ name: item.name, email: item.email, role: item.role })),
      ...conversations.map((item) => ({
        name: item.customer?.name,
        email: item.customer?.email,
        role: 'Customer',
      })),
      ...cases.map((item) => ({ name: item.name, email: item.email, role: 'Customer' })),
    ]
    return list.filter(
      (item, index, all) =>
        isRealEmail(item.email) &&
        all.findIndex((entry) => entry.email.toLowerCase() === item.email.toLowerCase()) === index,
    )
  }, [directory, conversations, cases])

  const admins = useMemo(
    () => users.filter((item) => String(item.role || '').toLowerCase() === 'admin'),
    [users],
  )

  const visibleUsers = audience === 'admins' ? admins : users
  const filteredUsers = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return visibleUsers
    return visibleUsers.filter((item) =>
      `${item.name} ${item.email}`.toLowerCase().includes(value),
    )
  }, [visibleUsers, query])

  const history = useMemo(
    () => emails.filter((item) => item.direction === 'out' || item.type === 'outbound'),
    [emails],
  )

  useEffect(() => {
    if (!presetEmail) return
    const match = users.find((item) => item.email.toLowerCase() === presetEmail)
    if (match) {
      setAudience('specific')
      setSelected([match])
    }
  }, [presetEmail, users])

  useEffect(() => {
    setUpdatedAt(new Date())
  }, [emails])

  function toggleUser(user) {
    setAudience('specific')
    setSelected((current) =>
      current.some((item) => item.email === user.email)
        ? current.filter((item) => item.email !== user.email)
        : [...current, user],
    )
  }

  function resolveRecipients() {
    if (audience === 'admins') return admins
    if (audience === 'specific') return selected.filter((item) => isRealEmail(item.email))
    return users
  }

  const previewRecipient = useMemo(() => {
    const list = audience === 'admins' ? admins : audience === 'specific' ? selected : users
    return list[0] || { name: admin?.name || 'there', email: admin?.email || '' }
  }, [audience, admins, selected, users, admin])

  const previewSubject = applyEmailMerge(subject, { ...mergeFields, name: previewRecipient.name })
  const previewBody = applyEmailMerge(body, { ...mergeFields, name: previewRecipient.name })
  const activeMergeFields = usedMergeFields(`${subject}\n${body}`)
  const fullDocumentPreview = isFullEmailDocument(body)

  function applyTemplate(id) {
    setTemplateId(id)
    if (!id) return
    const template = templates.find((item) => item.id === id)
    if (!template) return
    setSubject(template.subject || '')
    setBody(template.body || '')
    setMergeFields(defaultMergeValues(template.defaults || {}))
  }

  async function deliver(list, { toAll, nextSubject = subject, nextBody = body } = {}) {
    return sendToUsers({
      recipients: list,
      toAll,
      subject: nextSubject,
      body: nextBody,
      merge: mergeFields,
    })
  }

  async function handleSend(event) {
    event?.preventDefault?.()
    setError('')
    setNotice('')
    if (!usingSupabase) {
      setError('Supabase is not configured on this deploy, so email cannot be sent.')
      return
    }
    if (!subject.trim() || !body.trim()) {
      setError('Add a subject and message.')
      return
    }
    const list = resolveRecipients()
    if (list.length === 0) {
      setError(audience === 'specific' ? 'Select at least one recipient.' : 'No deliverable users yet.')
      return
    }
    setSending(true)
    const sent = await deliver(list, { toAll: audience === 'all' })
    setSending(false)
    if (!sent) {
      setError('Could not send that email.')
      return
    }
    if (sent.deliveryError) {
      setError(sent.deliveryError)
      return
    }
    setNotice(`Email sent to ${audience === 'all' ? `${users.length} users` : `${list.length} recipient(s)`}.`)
    setSubject('')
    setBody('')
    setTemplateId('')
    setMergeFields(defaultMergeValues())
    setSelected([])
  }

  async function handleRetry(id) {
    setRetryingId(id)
    const result = await retryDelivery(id)
    setRetryingId('')
    setNotice(result?.ok === false ? result.error : 'Send retried through Resend.')
  }

  return (
    <AdminLayout
      title="Email Delivery Service"
      subtitle="Compose and send email to users, then track delivery."
      actions={
        <div className="delivery-meta">
          <span>
            Last updated: {updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
          </span>
          <button className="dash-primary" type="button" onClick={handleSend} disabled={sending}>
            <SendIcon />
            {sending ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      }
    >
      <form className="delivery-compose dash-card" onSubmit={handleSend}>
        <div className="delivery-compose-copy">
          <h2>Compose Email</h2>
          <label>
            Template
            <select value={templateId} onChange={(event) => applyTemplate(event.target.value)}>
              <option value="">Blank message</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Enter email subject"
            />
          </label>
          {activeMergeFields.length > 0 && (
            <div className="merge-fields">
              {activeMergeFields.map((field) => (
                <label key={field.key}>
                  {field.label}
                  <input
                    value={mergeFields[field.key] || ''}
                    onChange={(event) =>
                      setMergeFields((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                    placeholder={field.label}
                  />
                </label>
              ))}
            </div>
          )}
          {(error || notice || loadError) && (
            <p className={error || (loadError && !notice) ? 'login-error' : 'login-copy'}>
              {notice || error || loadError}
            </p>
          )}
          <div className="delivery-actions">
            <button className="dash-primary" type="submit" disabled={sending}>
              <SendIcon />
              {sending ? 'Sending...' : 'Send Email'}
            </button>
          </div>
          <details className="html-source" open={!fullDocumentPreview}>
            <summary>Message {fullDocumentPreview ? 'HTML' : '(HTML supported)'}</summary>
            <label>
              <textarea
                rows={fullDocumentPreview ? '8' : '18'}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write your message. You can use HTML tags."
              />
              <small>
                Choose a template or write HTML. Merge tags like <code>{'{{first_name}}'}</code> are filled per
                recipient.
              </small>
            </label>
          </details>
          <section className="message-preview" aria-live="polite">
            <div className="message-preview-label">Message preview</div>
            {fullDocumentPreview ? (
              <div className="email-frame email-frame-full">
                <iframe
                  title="Email preview"
                  className="email-frame-doc"
                  sandbox=""
                  srcDoc={previewHtml(previewBody)}
                />
              </div>
            ) : (
              <div className="email-frame">
                <div className="email-frame-bar">
                  <img src="/logo.png" alt="" />
                  Chime
                </div>
                <div className="email-frame-body">
                  <h3>{previewSubject.trim() || 'Subject'}</h3>
                  <div
                    className="email-frame-copy"
                    dangerouslySetInnerHTML={{ __html: previewHtml(previewBody) }}
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="delivery-recipients">
          <label>
            Send To
            <select
              value={audience}
              onChange={(event) => {
                setAudience(event.target.value)
                if (event.target.value !== 'specific') setSelected([])
              }}
            >
              <option value="all">All Users ({users.length})</option>
              <option value="specific">Specific Users</option>
              <option value="admins">Admins ({admins.length})</option>
            </select>
          </label>
          <p className="recipient-heading">Select Recipients</p>
          <label className="table-search recipient-search">
            <IconSearch />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users..."
            />
          </label>
          <ul className="recipient-picker">
            {filteredUsers.map((user) => {
              const checked = selected.some((item) => item.email === user.email)
              return (
                <li key={user.email}>
                  <label>
                    <input type="checkbox" checked={checked} onChange={() => toggleUser(user)} />
                    <span className="picker-avatar" style={{ background: avatarColor(user.email) }}>
                      {initials(user.name)}
                    </span>
                    <span>
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </span>
                  </label>
                </li>
              )
            })}
            {filteredUsers.length === 0 && <li className="empty-inbox">No matching users</li>}
          </ul>
          <p className="selected-count">
            {audience === 'all'
              ? `${users.length} user(s) will receive this email`
              : `${selected.length} user(s) selected`}
          </p>
        </aside>
      </form>

      <section className="dash-card delivery-history">
        <div className="card-head">
          <div>
            <h2>Email History</h2>
            <p>Recently sent emails with delivery status</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Recipients</th>
                <th>Status</th>
                <th>Sent At</th>
                <th>Resend ID</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => {
                const emailsList = recipientEmails(item)
                const count = item.toAll ? users.length || emailsList.length : emailsList.length
                const status = item.deliveryStatus || 'pending'
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.subject}</strong>
                    </td>
                    <td>
                      <span className="recipient-chip">{count || emailsList.length} recipient(s)</span>
                      <small>{emailsList.slice(0, 3).join(', ') || item.to || 'Users'}</small>
                    </td>
                    <td>
                      <span className={`status-badge ${status === 'skipped' ? 'failed' : status}`}>
                        <StatusIcon status={status === 'skipped' ? 'failed' : status} />
                        {deliveryLabel(status)}
                      </span>
                    </td>
                    <td>{formatStamp(item.sentAt || item.time)}</td>
                    <td>
                      {item.resendId ? <code className="resend-id">{item.resendId}</code> : 'N/A'}
                      {(status === 'failed' || status === 'pending') && (
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => handleRetry(item.id)}
                          disabled={retryingId === item.id}
                        >
                          {retryingId === item.id ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {history.length === 0 && (
                <tr>
                  <td colSpan="5">
                    <p className="empty-inbox">
                      {loading ? 'Loading email history...' : 'No mail sent yet. Compose an email above to send it.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  )
}
