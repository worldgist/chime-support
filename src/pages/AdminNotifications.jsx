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
import { CATALOG_TEMPLATES, mergeEmailTemplates } from '../data/emailCatalog'
import { applyEmailMerge, attachEmailLink, defaultMergeValues, isFullEmailDocument, normalizeHttpUrl } from '../utils/emailMerge'

const FEATURED_TEMPLATE_IDS = ['refund-pending', 'payment-processed', 'pay-anyone']

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

function TemplateEditor({ form, setForm, error, saving, onCancel, onSubmit }) {
  const previewMerge = defaultMergeValues(form)
  const previewBody = applyEmailMerge(form.body, previewMerge)
  const fullDocumentPreview = isFullEmailDocument(form.body)
  const original = CATALOG_TEMPLATES.find((item) => item.id === form.id)

  function restoreOriginal() {
    if (!original) return
    setForm((current) => ({
      ...current,
      name: original.name,
      desc: original.desc,
      subject: original.subject,
      snippet: original.snippet,
      body: original.body,
      cta: original.cta,
    }))
  }

  return (
    <div className="kyc-modal" role="dialog" aria-labelledby="template-editor-title">
      <form className="kyc-modal-card template-editor-card" onSubmit={onSubmit}>
        <h2 id="template-editor-title">Edit template</h2>
        <p>Change the saved name, subject, and message. Merge tags like {'{{first_name}}'} are filled per recipient.</p>
        <label>
          Template name
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </label>
        <label>
          Description
          <input
            value={form.desc || ''}
            onChange={(event) => setForm((current) => ({ ...current, desc: event.target.value }))}
            placeholder="When this email is sent"
          />
        </label>
        <label>
          Subject
          <input
            value={form.subject}
            onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
            required
          />
        </label>
        <label>
          Message
          <textarea
            rows="14"
            value={form.body}
            onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
            placeholder="Write the email. HTML is supported."
            required
          />
        </label>
        <section className="message-preview" aria-live="polite">
          <div className="message-preview-label">Preview</div>
          {fullDocumentPreview ? (
            <div className="email-frame email-frame-full">
              <iframe title="Template preview" className="email-frame-doc" sandbox="" srcDoc={previewHtml(previewBody)} />
            </div>
          ) : (
            <div className="email-frame">
              <div className="email-frame-bar">
                <img src="/logo.png" alt="" />
                Chime
              </div>
              <div className="email-frame-body">
                <h3>{applyEmailMerge(form.subject, previewMerge) || 'Subject'}</h3>
                <div className="email-frame-copy" dangerouslySetInnerHTML={{ __html: previewHtml(previewBody) }} />
              </div>
            </div>
          )}
        </section>
        {error && <p className="login-error">{error}</p>}
        <div className="kyc-modal-actions">
          {original && (
            <button className="ghost-btn template-restore" type="button" onClick={restoreOriginal} disabled={saving}>
              Restore original
            </button>
          )}
          <button className="ghost-btn" type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className="dash-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save template'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function AdminNotifications() {
  const { admin } = useAuth()
  const { conversations } = useChat()
  const { cases } = useKyc()
  const { users: directory } = useUsers()
  const { emails, templates, sendToUsers, retryDelivery, upsertTemplate, loading, error: loadError, usingSupabase } = useNotifications()
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
  const [templateForm, setTemplateForm] = useState(null)
  const [templateError, setTemplateError] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

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

  const composeTemplates = useMemo(() => mergeEmailTemplates(templates), [templates])

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

  const previewMerge = {
    ...mergeFields,
    name: previewRecipient.name,
    link_url: normalizeHttpUrl(mergeFields.link_url),
  }
  const previewSubject = applyEmailMerge(subject, previewMerge)
  const previewBody = applyEmailMerge(attachEmailLink(body, previewMerge), previewMerge)
  const activeMergeFields = usedMergeFields(`${subject}\n${body}`)
  const fullDocumentPreview = isFullEmailDocument(body)

  function applyTemplate(id) {
    setTemplateId(id)
    if (!id) return
    const template = composeTemplates.find((item) => item.id === id)
    if (!template) return
    setSubject(template.subject || '')
    setBody(template.body || '')
    setMergeFields((current) =>
      defaultMergeValues({
        ...(template.defaults || {}),
        link_url: current.link_url || template.defaults?.link_url,
        link_label: current.link_label || template.defaults?.link_label,
      }),
    )
  }

  function openTemplateEditor(template) {
    setTemplateError('')
    setTemplateForm({
      id: template.id,
      name: template.name || '',
      desc: template.desc || '',
      subject: template.subject || '',
      snippet: template.snippet || '',
      body: template.body || '',
      cta: template.cta || '',
      icon: template.icon || 'mail',
      tone: template.tone || 'green',
      status: template.status || 'active',
      defaults: template.defaults,
    })
  }

  async function persistTemplate(next) {
    setSavingTemplate(true)
    const result = await upsertTemplate(next)
    setSavingTemplate(false)
    if (!result.ok) return result
    if (templateId && result.template?.id === templateId) {
      setSubject(result.template.subject || '')
      setBody(result.template.body || '')
    }
    return result
  }

  async function handleSaveComposeTemplate() {
    setError('')
    setNotice('')
    if (!templateId) {
      setError('Choose a template to save.')
      return
    }
    const current = composeTemplates.find((item) => item.id === templateId)
    if (!current) {
      setError('Choose a template to save.')
      return
    }
    if (!subject.trim() || !body.trim()) {
      setError('Add a subject and message before saving the template.')
      return
    }
    const result = await persistTemplate({
      ...current,
      subject,
      body,
      snippet: current.snippet || subject,
    })
    if (!result.ok) {
      setError(result.error || 'Could not save that template.')
      return
    }
    setNotice(`Saved ${current.name}.`)
  }

  async function handleSaveTemplateEditor(event) {
    event.preventDefault()
    setTemplateError('')
    if (!templateForm?.name?.trim() || !templateForm?.subject?.trim() || !String(templateForm.body || '').trim()) {
      setTemplateError('Enter a name, subject, and message.')
      return
    }
    const result = await persistTemplate({
      ...templateForm,
      snippet: templateForm.snippet || templateForm.subject,
    })
    if (!result.ok) {
      setTemplateError(result.error || 'Could not save that template.')
      return
    }
    setTemplateForm(null)
    setNotice(`Saved ${result.template.name}.`)
  }

  function composedMerge() {
    const link_url = normalizeHttpUrl(mergeFields.link_url)
    return {
      ...mergeFields,
      link_url,
      app_url: link_url || mergeFields.app_url,
      support_url: link_url || mergeFields.support_url,
    }
  }

  async function deliver(list, { toAll, nextSubject = subject, nextBody = body } = {}) {
    const merge = composedMerge()
    return sendToUsers({
      recipients: list,
      toAll,
      subject: nextSubject,
      body: attachEmailLink(nextBody, merge),
      merge,
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
    if (String(mergeFields.link_url || '').trim() && !normalizeHttpUrl(mergeFields.link_url)) {
      setError('Enter a valid http(s) link.')
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
            <div className="template-picks">
              {FEATURED_TEMPLATE_IDS.map((id) => {
                const template = composeTemplates.find((item) => item.id === id)
                if (!template) return null
                return (
                  <button
                    key={id}
                    type="button"
                    className={`template-pick${templateId === id ? ' is-active' : ''}`}
                    onClick={() => applyTemplate(id)}
                  >
                    {template.name}
                  </button>
                )
              })}
            </div>
            <select value={templateId} onChange={(event) => applyTemplate(event.target.value)}>
              <option value="">Blank message</option>
              <optgroup label="Branded emails">
                {composeTemplates
                  .filter((template) => FEATURED_TEMPLATE_IDS.includes(template.id))
                  .map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Other templates">
                {composeTemplates
                  .filter((template) => !FEATURED_TEMPLATE_IDS.includes(template.id))
                  .map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
              </optgroup>
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
          <div className="email-link-fields">
            <label>
              Link URL
              <input
                type="url"
                value={mergeFields.link_url || ''}
                onChange={(event) =>
                  setMergeFields((current) => ({ ...current, link_url: event.target.value }))
                }
                placeholder="https://example.com/page"
              />
            </label>
            <label>
              Link text
              <input
                value={mergeFields.link_label || ''}
                onChange={(event) =>
                  setMergeFields((current) => ({ ...current, link_label: event.target.value }))
                }
                placeholder="Open link"
              />
            </label>
            <small>Recipients can tap this button in the email to open the page.</small>
          </div>
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
            <button
              className="ghost-btn"
              type="button"
              onClick={handleSaveComposeTemplate}
              disabled={savingTemplate || !templateId}
            >
              {savingTemplate ? 'Saving...' : 'Save template'}
            </button>
          </div>
          <details className="html-source" open>
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

      <section className="dash-card">
        <div className="card-head">
          <div>
            <h2>Templates</h2>
            <p>Click a row to use it, or Edit to change the saved message.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {composeTemplates.map((template) => (
                <tr
                  key={template.id}
                  className={templateId === template.id ? 'selected' : ''}
                  onClick={() => applyTemplate(template.id)}
                >
                  <td>
                    <strong>{template.name}</strong>
                    <small>{template.desc || template.snippet}</small>
                  </td>
                  <td>{template.subject}</td>
                  <td>
                    <span className={`status-badge ${template.status || 'active'}`}>
                      <i />
                      {template.status || 'active'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={(event) => {
                        event.stopPropagation()
                        openTemplateEditor(template)
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
      {templateForm && (
        <TemplateEditor
          form={templateForm}
          setForm={setTemplateForm}
          error={templateError}
          saving={savingTemplate}
          onCancel={() => setTemplateForm(null)}
          onSubmit={handleSaveTemplateEditor}
        />
      )}
    </AdminLayout>
  )
}
