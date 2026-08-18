import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { CATALOG_TEMPLATES } from '../data/emailCatalog'
import { useNotifications } from '../context/NotificationContext'
import { FROM_EMAIL } from '../utils/emailDelivery'
import {
  IconCard,
  IconGift,
  IconLock,
  IconMail,
  IconSearch,
  IconShield,
  IconSpark,
  IconSwap,
  IconUsers,
} from '../components/adminIcons'

const TEMPLATE_ICONS = {
  mail: <IconMail />,
  lock: <IconLock />,
  card: <IconCard />,
  shield: <IconShield />,
  users: <IconUsers />,
  gift: <IconGift />,
  spark: <IconSpark />,
  swap: <IconSwap />,
}

const TABS = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'sent', label: 'Sent' },
  { id: 'templates', label: 'Templates' },
  { id: 'settings', label: 'Settings' },
]

function deliveryLabel(status) {
  if (status === 'sent') return 'Sent'
  if (status === 'failed') return 'Failed'
  if (status === 'skipped') return 'Skipped'
  if (status === 'sending') return 'Sending'
  return 'Pending'
}

const emptyTemplate = {
  name: '',
  desc: '',
  subject: '',
  snippet: '',
  body: '',
  cta: '',
  status: 'active',
  icon: 'mail',
  tone: 'green',
}

export default function AdminNotifications() {
  const navigate = useNavigate()
  const {
    templates: storedTemplates,
    emails,
    settings,
    updateSettings,
    markRead,
    markAllRead,
    retryDelivery,
    removeEmail,
    upsertTemplate,
    removeTemplate,
    toggleTemplateStatus,
    loading,
    error: loadError,
  } = useNotifications()
  const catalog = storedTemplates?.length ? storedTemplates : CATALOG_TEMPLATES
  const [tab, setTab] = useState('inbox')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [retrying, setRetrying] = useState(false)
  const [notice, setNotice] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [templateModal, setTemplateModal] = useState(null)
  const [templateForm, setTemplateForm] = useState(emptyTemplate)
  const [templateError, setTemplateError] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [recipientDraft, setRecipientDraft] = useState(settings.recipient)

  useEffect(() => {
    setRecipientDraft(settings.recipient)
  }, [settings.recipient])

  const inbox = useMemo(
    () => emails.filter((item) => item.direction !== 'out'),
    [emails],
  )
  const sent = useMemo(
    () => emails.filter((item) => item.direction === 'out'),
    [emails],
  )
  const mailList = tab === 'sent' ? sent : inbox

  const filteredMail = useMemo(() => {
    const value = query.trim().toLowerCase()
    return mailList.filter((item) =>
      `${item.subject} ${item.to} ${item.from} ${item.preview}`.toLowerCase().includes(value),
    )
  }, [mailList, query])

  const templates = useMemo(() => {
    const value = query.trim().toLowerCase()
    return catalog.filter((item) =>
      `${item.name} ${item.subject} ${item.desc}`.toLowerCase().includes(value),
    )
  }, [catalog, query])

  const selectedMail = filteredMail.find((item) => item.id === selectedId) || filteredMail[0]
  const selectedTemplate = catalog.find((item) => item.id === selectedId) || templates[0]

  const sentCount = sent.length
  const delivered = emails.filter((item) => item.deliveryStatus === 'sent').length
  const failed = emails.filter((item) => item.deliveryStatus === 'failed').length

  function openMail(item) {
    setSelectedId(item.id)
    if (!item.read && item.direction !== 'out') markRead(item.id)
  }

  async function handleRetry() {
    if (!selectedMail?.id) return
    setRetrying(true)
    const result = await retryDelivery(selectedMail.id)
    setRetrying(false)
    setNotice(result?.ok === false ? result.error : 'Send retried through Resend.')
  }

  async function handleSaveSettings(event) {
    event.preventDefault()
    setSavingSettings(true)
    const result = await updateSettings({ ...settings, recipient: recipientDraft })
    setSavingSettings(false)
    setNotice(result?.ok === false ? result.error : 'Alert settings saved.')
  }

  function openCreateTemplate() {
    setTemplateForm(emptyTemplate)
    setTemplateError('')
    setTemplateModal('create')
  }

  function openEditTemplate(item) {
    setSelectedId(item.id)
    setTemplateForm({
      id: item.id,
      name: item.name,
      desc: item.desc || '',
      subject: item.subject,
      snippet: item.snippet || '',
      body: item.body || '',
      cta: item.cta || '',
      status: item.status || 'active',
      icon: item.icon || 'mail',
      tone: item.tone || 'green',
    })
    setTemplateError('')
    setTemplateModal('edit')
  }

  async function handleSaveTemplate(event) {
    event.preventDefault()
    setSavingTemplate(true)
    const result = await upsertTemplate(templateForm)
    setSavingTemplate(false)
    if (!result.ok) {
      setTemplateError(result.error)
      return
    }
    setTemplateModal(null)
    setNotice(`${result.template.name} was saved.`)
    setSelectedId(result.template.id)
  }

  async function handleDeleteTemplate(item) {
    if (!window.confirm(`Delete template “${item.name}”?`)) return
    const result = await removeTemplate(item.id)
    setNotice(result.ok ? `${item.name} was deleted.` : result.error)
  }

  return (
    <AdminLayout
      title="Email Notifications"
      subtitle="Live Resend delivery for admin alerts and customer mail."
      actions={
        <div className="user-actions" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {tab !== 'settings' && (
            <button className="ghost-btn" type="button" onClick={() => markAllRead()}>
              Mark inbox read
            </button>
          )}
          {tab === 'templates' && (
            <button className="ghost-btn" type="button" onClick={openCreateTemplate}>
              + New template
            </button>
          )}
          <button className="dash-primary" type="button" onClick={() => navigate('/admin/notifications/create')}>
            + Create New Email
          </button>
        </div>
      }
    >
      <div className="email-tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'active' : ''}
            onClick={() => {
              setTab(item.id)
              setQuery('')
              setSelectedId(null)
            }}
          >
            {item.label}
            {item.id === 'inbox' && inbox.filter((mail) => !mail.read).length > 0
              ? ` ${inbox.filter((mail) => !mail.read).length}`
              : ''}
          </button>
        ))}
      </div>

      {(loadError || notice) && (
        <p className={loadError && !notice ? 'login-error' : 'login-copy'}>{notice || loadError}</p>
      )}
      {loading && <p className="login-copy">Loading email notifications...</p>}

      {tab === 'settings' ? (
        <form className="dash-card padded email-settings" onSubmit={handleSaveSettings}>
          <h2>Alert settings</h2>
          <p className="login-copy">
            Admin alerts are sent through Resend from {FROM_EMAIL} to the inbox below.
          </p>
          <label>
            Admin inbox
            <input
              type="email"
              value={recipientDraft}
              onChange={(event) => setRecipientDraft(event.target.value)}
              required
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.chatMessages}
              onChange={(event) => updateSettings({ chatMessages: event.target.checked })}
            />
            Email me about new chat messages
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.kycPending}
              onChange={(event) => updateSettings({ kycPending: event.target.checked })}
            />
            Email me when KYC is submitted
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.kycDecisions}
              onChange={(event) => updateSettings({ kycDecisions: event.target.checked })}
            />
            Email me when KYC is approved or rejected
          </label>
          <div className="kyc-modal-actions">
            <button className="dash-primary" type="submit" disabled={savingSettings}>
              {savingSettings ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </form>
      ) : tab === 'templates' ? (
        <div className="email-layout">
          <section className="dash-card">
            <div className="card-toolbar">
              <label className="table-search">
                <IconSearch />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search templates..."
                />
              </label>
            </div>
            <div className="table-scroll">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Template Name</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((item) => (
                    <tr
                      key={item.id}
                      className={item.id === selectedTemplate?.id ? 'selected' : ''}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <td>
                        <div className="template-name">
                          <span className={`template-icon ${item.tone}`}>{TEMPLATE_ICONS[item.icon]}</span>
                          <span>
                            <strong>{item.name}</strong>
                            <small>{item.desc}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong>{item.subject}</strong>
                        <small>{item.snippet}</small>
                      </td>
                      <td>
                        <span className={`status-badge ${item.status}`}>
                          <i />
                          {item.status}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={(event) => {
                            event.stopPropagation()
                            navigate(`/admin/notifications/create?template=${item.id}`)
                          }}
                        >
                          Use
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={(event) => {
                            event.stopPropagation()
                            openEditTemplate(item)
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleTemplateStatus(item.id)
                          }}
                        >
                          {item.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDeleteTemplate(item)
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="email-side">
            {selectedTemplate ? (
              <section className="dash-card preview-card">
                <div className="card-head">
                  <h2>Email Preview</h2>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => navigate(`/admin/notifications/create?template=${selectedTemplate.id}`)}
                  >
                    Send
                  </button>
                </div>
                <div className="email-preview">
                  <p className="preview-subject">Subject: {selectedTemplate.subject}</p>
                  <div className="preview-letter">
                    <img src="/logo.png" alt="" />
                    <h3>{selectedTemplate.body.split('\n')[0]}</h3>
                    <p>{selectedTemplate.body.split('\n').slice(2).join(' ') || selectedTemplate.snippet}</p>
                    <span className="preview-cta">{selectedTemplate.cta}</span>
                  </div>
                </div>
              </section>
            ) : (
              <section className="dash-card padded">
                <p>No templates match that search.</p>
              </section>
            )}
          </aside>
        </div>
      ) : (
        <div className="email-layout">
          <section className="dash-card">
            <div className="card-toolbar">
              <label className="table-search">
                <IconSearch />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={tab === 'sent' ? 'Search sent mail...' : 'Search inbox...'}
                />
              </label>
            </div>
            <div className="table-scroll">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>{tab === 'sent' ? 'To' : 'From'}</th>
                    <th>Subject</th>
                    <th>Delivery</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMail.map((item) => (
                    <tr
                      key={item.id}
                      className={item.id === selectedMail?.id ? 'selected' : ''}
                      onClick={() => openMail(item)}
                    >
                      <td>
                        <strong>{tab === 'sent' ? item.to || 'Customers' : item.from}</strong>
                        {!item.read && item.direction !== 'out' ? <small>Unread</small> : null}
                      </td>
                      <td>
                        <strong>{item.subject}</strong>
                        <small>{item.preview}</small>
                      </td>
                      <td>
                        <span className={`status-badge ${item.deliveryStatus || 'pending'}`}>
                          <i />
                          {deliveryLabel(item.deliveryStatus)}
                        </span>
                      </td>
                      <td>{item.time}</td>
                    </tr>
                  ))}
                  {filteredMail.length === 0 && (
                    <tr>
                      <td colSpan="4">
                        <p className="empty-inbox">
                          {tab === 'sent'
                            ? 'No mail sent yet. Create an email to send through Resend.'
                            : 'No admin alerts yet. Chat and KYC events will appear here.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="email-side">
            {selectedMail ? (
              <section className="dash-card preview-card">
                <div className="card-head">
                  <h2>{selectedMail.subject}</h2>
                  <span className={`status-badge ${selectedMail.deliveryStatus || 'pending'}`}>
                    <i />
                    {deliveryLabel(selectedMail.deliveryStatus)}
                  </span>
                </div>
                <div className="email-preview">
                  <p className="preview-subject">From: {selectedMail.from}</p>
                  <p className="preview-subject">To: {selectedMail.to || settings.recipient}</p>
                  <div className="preview-letter">
                    {selectedMail.body.split('\n').map((line, index) => (
                      <p key={`${selectedMail.id}-${index}`}>{line || '\u00a0'}</p>
                    ))}
                  </div>
                  {selectedMail.deliveryError && (
                    <p className="login-error">{selectedMail.deliveryError}</p>
                  )}
                  {selectedMail.resendId && (
                    <p className="login-copy">Resend ID: {selectedMail.resendId}</p>
                  )}
                </div>
                <div className="kyc-modal-actions" style={{ padding: '0 16px 16px' }}>
                  {(selectedMail.deliveryStatus === 'failed' || selectedMail.deliveryStatus === 'pending') && (
                    <button type="button" className="dash-primary" onClick={handleRetry} disabled={retrying}>
                      {retrying ? 'Sending...' : 'Retry send'}
                    </button>
                  )}
                  {selectedMail.href && (
                    <button type="button" className="ghost-btn" onClick={() => navigate(selectedMail.href)}>
                      Open related page
                    </button>
                  )}
                  <button type="button" className="ghost-btn" onClick={() => removeEmail(selectedMail.id)}>
                    Delete
                  </button>
                </div>
              </section>
            ) : (
              <section className="dash-card padded">
                <p>Select a message to read it.</p>
              </section>
            )}

            <section className="dash-card">
              <div className="card-head">
                <h2>Delivery</h2>
              </div>
              <div className="summary-grid">
                <article>
                  <span>Sent copies</span>
                  <strong>{sentCount}</strong>
                </article>
                <article>
                  <span>Resend delivered</span>
                  <strong>{delivered}</strong>
                </article>
                <article>
                  <span>Failed</span>
                  <strong>{failed}</strong>
                </article>
                <article>
                  <span>Inbox</span>
                  <strong>{inbox.length}</strong>
                </article>
              </div>
            </section>
          </aside>
        </div>
      )}
      {templateModal && (
        <div className="kyc-modal" role="dialog" aria-labelledby="template-form-title">
          <form className="kyc-modal-card" onSubmit={handleSaveTemplate}>
            <h2 id="template-form-title">{templateModal === 'edit' ? 'Edit template' : 'Create template'}</h2>
            <p>Templates are stored in Supabase and can be used when composing Resend mail.</p>
            <label>
              Name
              <input
                value={templateForm.name}
                onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label>
              Description
              <input
                value={templateForm.desc}
                onChange={(event) => setTemplateForm((current) => ({ ...current, desc: event.target.value }))}
              />
            </label>
            <label>
              Subject
              <input
                value={templateForm.subject}
                onChange={(event) => setTemplateForm((current) => ({ ...current, subject: event.target.value }))}
                required
              />
            </label>
            <label>
              Preview snippet
              <input
                value={templateForm.snippet}
                onChange={(event) => setTemplateForm((current) => ({ ...current, snippet: event.target.value }))}
              />
            </label>
            <label>
              Body
              <textarea
                rows="6"
                value={templateForm.body}
                onChange={(event) => setTemplateForm((current) => ({ ...current, body: event.target.value }))}
              />
            </label>
            <label>
              Status
              <select
                value={templateForm.status}
                onChange={(event) => setTemplateForm((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
            {templateError && <p className="login-error">{templateError}</p>}
            <div className="kyc-modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setTemplateModal(null)} disabled={savingTemplate}>
                Cancel
              </button>
              <button className="dash-primary" type="submit" disabled={savingTemplate}>
                {savingTemplate ? 'Saving...' : 'Save template'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  )
}
