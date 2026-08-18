import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { useKyc } from '../context/KycContext'
import { useUsers } from '../context/UserContext'
import { useNotifications } from '../context/NotificationContext'
import { CATALOG_TEMPLATES } from '../data/emailCatalog'
import { IconEye } from '../components/adminIcons'
import { FROM_EMAIL, SUPPORT_EMAIL, NOREPLY_EMAIL } from '../utils/emailDelivery'

function applyMerge(text, user) {
  return String(text || '')
    .replaceAll('{{user_name}}', user.name || 'there')
    .replaceAll('{name}', user.name || 'there')
    .replaceAll('{{amount}}', user.amount || '')
    .replaceAll('{{reason}}', user.reason || '')
}

function isRealEmail(email) {
  const value = String(email || '').trim().toLowerCase()
  return value.includes('@') && !value.endsWith('.local')
}

export default function AdminCreateEmail() {
  const { admin } = useAuth()
  const { conversations } = useChat()
  const { cases } = useKyc()
  const { users: directory } = useUsers()
  const { sendToUsers, templates: storedTemplates, settings } = useNotifications()
  const allTemplates = storedTemplates?.length ? storedTemplates : CATALOG_TEMPLATES
  const catalog = allTemplates.filter((item) => item.status !== 'inactive')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const preset = catalog.find((item) => item.id === params.get('template'))
  const presetEmail = String(params.get('email') || '').trim().toLowerCase()

  const customers = useMemo(() => {
    const list = [
      ...directory.map((item) => ({
        name: item.name,
        email: item.email,
        status: item.status,
        joined: item.joined,
        createdAt: item.createdAt,
      })),
      ...conversations.map((item) => item.customer),
      ...cases.map((item) => ({ name: item.name, email: item.email, status: item.status })),
    ]
    return list.filter(
      (item, index, all) =>
        isRealEmail(item.email) && all.findIndex((entry) => entry.email === item.email) === index,
    )
  }, [directory, conversations, cases])

  const [templateId, setTemplateId] = useState(preset?.id || '')
  const [audience, setAudience] = useState(presetEmail ? 'specific' : 'all')
  const [selected, setSelected] = useState([])
  const [subject, setSubject] = useState(preset?.subject || '')
  const [preheader, setPreheader] = useState(preset?.snippet || '')
  const [body, setBody] = useState(preset?.body || '')
  const [fromName, setFromName] = useState('Chime Support')
  const [fromEmail, setFromEmail] = useState(FROM_EMAIL)
  const [replyTo, setReplyTo] = useState(FROM_EMAIL)
  const [role, setRole] = useState('customers')
  const [segment, setSegment] = useState('new')
  const [showMerge, setShowMerge] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!presetEmail) return
    const match = customers.find((item) => String(item.email || '').toLowerCase() === presetEmail)
    if (match) setSelected([match])
  }, [presetEmail, customers])

  function resolveRecipients() {
    if (audience === 'specific') return selected.filter((item) => isRealEmail(item.email))
    if (audience === 'role' && role === 'admins') {
      const list = []
      if (settings?.recipient && isRealEmail(settings.recipient)) {
        list.push({ name: 'Support', email: settings.recipient })
      }
      if (admin?.email && isRealEmail(admin.email)) {
        list.push({ name: admin.name, email: admin.email })
      }
      directory
        .filter((item) => item.role === 'Admin' && isRealEmail(item.email))
        .forEach((item) => list.push({ name: item.name, email: item.email }))
      return list.filter((item, index, all) => all.findIndex((entry) => entry.email === item.email) === index)
    }
    if (audience === 'role' && role === 'pending-kyc') {
      return cases
        .filter((item) => ['awaiting', 'pending', 'review', 'more_info'].includes(item.status))
        .filter((item) => isRealEmail(item.email))
        .map((item) => ({ name: item.name, email: item.email }))
    }
    if (audience === 'segment' && segment === 'new') {
      return customers.filter((item) => {
        const created = item.createdAt ? new Date(item.createdAt) : null
        if (created && !Number.isNaN(created.getTime())) {
          return Date.now() - created.getTime() < 30 * 24 * 60 * 60 * 1000
        }
        return /today|2026|aug/i.test(String(item.joined || ''))
      })
    }
    if (audience === 'segment' && segment === 'inactive') {
      return customers.filter((item) => item.status === 'inactive' || item.status === 'review')
    }
    if (audience === 'segment' && segment === 'active') {
      return customers.filter((item) => item.status === 'active')
    }
    return customers
  }

  function applyTemplate(id) {
    setTemplateId(id)
    const template = catalog.find((item) => item.id === id)
    if (!template) return
    setSubject(template.subject)
    setPreheader(template.snippet)
    setBody(template.body)
  }

  function toggleUser(user) {
    setSelected((current) =>
      current.some((item) => item.email === user.email)
        ? current.filter((item) => item.email !== user.email)
        : [...current, user],
    )
  }

  function insertMerge(field) {
    setSubject((current) => (current.includes(field) ? current : `${current} ${field}`.trim()))
    setShowMerge(false)
  }

  async function deliver(list, { nextSubject, nextBody, toAll }) {
    const person = list[0] || { name: 'there' }
    return sendToUsers({
      recipients: list,
      toAll,
      subject: applyMerge(nextSubject, person),
      body: applyMerge(nextBody, person),
      fromName,
    })
  }

  async function handleSend(event) {
    event.preventDefault()
    setError('')
    const list = resolveRecipients()
    if (list.length === 0) {
      setError('No deliverable recipients for that audience.')
      return
    }
    setSending(true)
    const nextSubject = subject
    const nextBody = preheader ? `${body}\n\n${preheader}` : body
    let sent
    if ((audience === 'specific' || audience === 'role') && list.length <= 10) {
      for (const person of list) {
        sent = await sendToUsers({
          recipients: [person],
          toAll: false,
          subject: applyMerge(nextSubject, person),
          body: applyMerge(nextBody, person),
          fromName,
        })
        if (!sent || sent.deliveryError) break
      }
    } else {
      sent = await deliver(list, {
        nextSubject,
        nextBody,
        toAll: audience === 'all',
      })
    }
    setSending(false)
    if (!sent) {
      setError('Add a subject, message, and at least one recipient.')
      return
    }
    if (sent.deliveryError) {
      setError(sent.deliveryError)
      return
    }
    navigate('/admin/notifications')
  }

  return (
    <AdminLayout title="Create New Email" subtitle="Compose and send a notification to users.">
      <form className="create-email" onSubmit={handleSend}>
        <section className="dash-card padded">
          <h2>Email Details</h2>
          <label>
            Template
            <select value={templateId} onChange={(event) => applyTemplate(event.target.value)}>
              <option value="">Select a template (optional)</option>
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend>Recipients</legend>
            {['all', 'role', 'specific', 'segment'].map((item) => (
              <label key={item} className="radio">
                <input
                  type="radio"
                  name="audience"
                  checked={audience === item}
                  onChange={() => setAudience(item)}
                />
                {item === 'all' && 'All Users'}
                {item === 'role' && 'Users by Role'}
                {item === 'specific' && 'Specific Users'}
                {item === 'segment' && (
                  <>
                    Custom Segment <em className="new-badge">New</em>
                  </>
                )}
              </label>
            ))}
          </fieldset>

          {audience === 'role' && (
            <label>
              Role
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="customers">Customers</option>
                <option value="admins">Admins</option>
                <option value="pending-kyc">Pending KYC</option>
              </select>
            </label>
          )}

          {audience === 'segment' && (
            <label>
              Segment
              <select value={segment} onChange={(event) => setSegment(event.target.value)}>
                <option value="new">Joined in the last 30 days</option>
                <option value="active">Active users</option>
                <option value="inactive">Inactive or in review</option>
              </select>
            </label>
          )}

          {audience === 'specific' && (
            <div className="recipient-list">
              {customers.map((user) => (
                <label key={user.email} className="toggle">
                  <input
                    type="checkbox"
                    checked={selected.some((item) => item.email === user.email)}
                    onChange={() => toggleUser(user)}
                  />
                  {user.name} · {user.email}
                </label>
              ))}
              {customers.length === 0 && <p>No customer emails yet.</p>}
            </div>
          )}

          <label className="subject-field">
            Subject
            <div className="input-with-action">
              <input value={subject} onChange={(event) => setSubject(event.target.value)} required />
              <button type="button" className="ghost-btn" onClick={() => setShowMerge((value) => !value)}>
                Insert Merge Field
              </button>
            </div>
            {showMerge && (
              <div className="merge-menu">
                {['{{user_name}}', '{{amount}}', '{{reason}}'].map((field) => (
                  <button type="button" key={field} onClick={() => insertMerge(field)}>
                    {field}
                  </button>
                ))}
              </div>
            )}
          </label>
          <label>
            Preheader
            <input
              value={preheader}
              maxLength={150}
              onChange={(event) => setPreheader(event.target.value)}
              placeholder="Optional inbox preview text"
            />
            <small>{preheader.length}/150</small>
          </label>
          <label>
            Email content
            <textarea
              rows="10"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Start typing your email content..."
              required
            />
            <small>{body.split(/\s+/).filter(Boolean).length} words</small>
          </label>
          {error && <p className="login-error">{error}</p>}
          <div className="create-actions">
            <button type="button" className="ghost-btn" onClick={() => navigate('/admin/notifications')}>
              Cancel
            </button>
            <button className="dash-primary" type="submit" disabled={sending}>
              {sending ? 'Sending...' : 'Send email'}
            </button>
          </div>
        </section>

        <aside className="create-side">
          <section className="dash-card padded">
            <h2>Email Settings</h2>
            <label>
              From Name
              <input value={fromName} onChange={(event) => setFromName(event.target.value)} />
            </label>
            <label>
              From Email
              <select value={fromEmail} onChange={(event) => setFromEmail(event.target.value)}>
                <option>{FROM_EMAIL}</option>
                <option>{SUPPORT_EMAIL}</option>
                <option>{NOREPLY_EMAIL}</option>
              </select>
            </label>
            <label>
              Reply To
              <input value={replyTo} onChange={(event) => setReplyTo(event.target.value)} />
            </label>
            <label>
              Priority
              <select disabled>
                <option>Normal</option>
              </select>
            </label>
            <p className="login-copy">
              Messages are sent through Resend from {fromEmail} to the selected customers.
            </p>
          </section>

          <section className="dash-card padded">
            <h2>Email Preview</h2>
            <button type="button" className="ghost-btn" onClick={() => setPreview((value) => !value)}>
              <IconEye /> Preview Email
            </button>
            {preview && (
              <div className="preview-letter small">
                <img src="/logo.png" alt="" />
                <strong>{subject || 'Subject'}</strong>
                <p>{body || 'Your email content will appear here.'}</p>
              </div>
            )}
          </section>
        </aside>
      </form>
    </AdminLayout>
  )
}
