import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { useAuth } from '../context/AuthContext'
import { useKyc, verificationUrl } from '../context/KycContext'
import { initials } from '../context/ChatContext'

const FILTERS = ['all', 'awaiting', 'pending', 'review', 'more_info', 'approved', 'rejected']

const REJECT_REASONS = [
  'ID is blurry or unreadable',
  'Selfie does not match ID',
  'Proof of address is expired',
  'Personal details do not match documents',
]

function statusLabel(status) {
  if (status === 'more_info') return 'More info'
  if (status === 'review') return 'In review'
  if (status === 'awaiting') return 'Awaiting'
  return status
}

function DocumentPreview({ doc, name }) {
  if (doc?.src) {
    return (
      <div className={`doc-art photo ${doc.type}`}>
        <img src={doc.src} alt={doc.label} />
      </div>
    )
  }
  if (doc?.type === 'selfie') {
    return (
      <div className={`doc-art selfie ${doc.quality}`}>
        <span className="selfie-face">{initials(name)}</span>
        <small>Live selfie</small>
      </div>
    )
  }
  if (doc?.type === 'address') {
    return (
      <div className={`doc-art address ${doc.quality}`}>
        <b>STATEMENT</b>
        <span />
        <span />
        <span className="short" />
      </div>
    )
  }
  return (
    <div className={`doc-art id-card ${doc?.quality || ''}`}>
      <div className="id-chip" />
      <div className="id-photo">{initials(name)}</div>
      <div className="id-lines">
        <strong>{name}</strong>
        <span>USA DRIVER LICENSE</span>
        <span>{doc?.type === 'id-back' ? 'D.L. BACK' : 'D.L. FRONT'}</span>
      </div>
    </div>
  )
}

export default function AdminKyc() {
  const { admin } = useAuth()
  const {
    cases,
    activeId,
    activeCase,
    selectCase,
    setCaseStatus,
    createVerificationLink,
    createLinkForCase,
    counts,
  } = useKyc()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [note, setNote] = useState('')
  const [docId, setDocId] = useState(activeCase?.documents?.[0]?.id)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [formError, setFormError] = useState('')
  const [copied, setCopied] = useState('')
  const [lightbox, setLightbox] = useState(null)

  const queue = useMemo(() => {
    const value = query.trim().toLowerCase()
    return cases.filter((item) => {
      const matchesFilter = filter === 'all' || item.status === filter
      const haystack = `${item.name} ${item.email} ${item.address}`.toLowerCase()
      return matchesFilter && (!value || haystack.includes(value))
    })
  }, [cases, filter, query])

  const uploadedDocs = activeCase?.documents?.filter((item) => item.src) || []
  const selectedDoc = activeCase?.documents?.find((item) => item.id === docId) || activeCase?.documents?.[0]
  const link = activeCase?.token ? verificationUrl(activeCase.token) : ''
  const linkExpired = activeCase?.expiresAt && activeCase.expiresAt < Date.now() && activeCase.status === 'awaiting'

  useEffect(() => {
    if (!activeCase?.documents?.length) return
    if (!activeCase.documents.some((item) => item.id === docId)) {
      setDocId(activeCase.documents[0].id)
    }
  }, [activeCase, docId])

  function chooseCase(id) {
    selectCase(id)
    const next = cases.find((item) => item.id === id)
    setDocId(next?.documents?.[0]?.id)
    setNote('')
    setCopied('')
  }

  function act(status, presetNote) {
    const text = (presetNote || note).trim()
    if ((status === 'rejected' || status === 'more_info') && !text) {
      setNote(status === 'rejected' ? 'Documents could not be verified.' : 'Please upload a clearer document.')
      return
    }
    setCaseStatus(activeCase.id, status, text, admin.name)
    setNote('')
  }

  async function handleCreate(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const created = await createVerificationLink(form, admin.name)
      if (!created) {
        setFormError('Enter a full name and email.')
        return
      }
      setCreating(false)
      setForm({ name: '', email: '', phone: '' })
      setFormError('')
      setFilter('awaiting')
      setCopied('created')
    } catch (error) {
      setFormError(error.message || 'Could not create the verification link.')
    } finally {
      setSaving(false)
    }
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
    } catch {
      setCopied('failed')
    }
  }

  return (
    <AdminLayout
      title="KYC Management"
      subtitle={`${counts.pending + counts.review} need review · ${counts.awaiting} awaiting`}
      actions={
        <button className="dash-primary" type="button" onClick={() => setCreating(true)}>
          + Create verification link
        </button>
      }
    >
      <div className="kyc-stats">
        <article>
          <span>Awaiting</span>
          <strong>{counts.awaiting}</strong>
        </article>
        <article>
          <span>Pending</span>
          <strong>{counts.pending}</strong>
        </article>
        <article>
          <span>In review</span>
          <strong>{counts.review}</strong>
        </article>
        <article>
          <span>Approved</span>
          <strong>{counts.approved}</strong>
        </article>
        <article>
          <span>Rejected</span>
          <strong>{counts.rejected}</strong>
        </article>
      </div>

      <div className="kyc-grid">
        <aside className="inbox">
          <h2>Applications</h2>
          <input
            className="inbox-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            aria-label="Search KYC applications"
          />
          <div className="filter-row">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? 'filter active' : 'filter'}
                onClick={() => setFilter(item)}
              >
                {statusLabel(item)}
              </button>
            ))}
          </div>
          <div className="inbox-list">
            {queue.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`inbox-item${item.id === activeId ? ' active' : ''}`}
                onClick={() => chooseCase(item.id)}
              >
                <span className="avatar sm initials">{initials(item.name)}</span>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.documents?.some((doc) => doc.src || doc.mediaKey)
                      ? `${item.documents.length} uploads · ${item.submittedAt}`
                      : item.submittedAt}
                  </small>
                </span>
                <b className={`status-dot ${item.status}`} />
              </button>
            ))}
            {queue.length === 0 && (
              <p className="empty-inbox">
                {cases.length === 0 ? 'No KYC applications yet' : 'No matching applications'}
              </p>
            )}
          </div>
        </aside>

        <section className="kyc-review">
          {activeCase ? (
            <>
              <div className="admin-chat-head">
                <div>
                  <h2>{activeCase.name}</h2>
                  <p>
                    {activeCase.status === 'awaiting'
                      ? 'Waiting for the customer to complete verification'
                      : `Submitted ${activeCase.submittedAt} · Risk ${activeCase.risk}`}
                  </p>
                </div>
                <span className={`kyc-pill ${activeCase.status}`}>{statusLabel(activeCase.status)}</span>
              </div>

              {activeCase.documents.length === 0 ? (
                <div className="kyc-empty">
                  <p>No documents yet. Share the verification link so the customer can upload ID photos, SSN, and a selfie.</p>
                </div>
              ) : (
                <div className="kyc-viewer">
                  <div className="kyc-upload-summary">
                    <h3>Uploaded details</h3>
                    <ul>
                      <li>
                        <span>Full name</span>
                        <strong>{activeCase.name}</strong>
                      </li>
                      <li>
                        <span>Email</span>
                        <strong>{activeCase.email}</strong>
                      </li>
                      <li>
                        <span>Phone</span>
                        <strong>{activeCase.phone}</strong>
                      </li>
                      <li>
                        <span>SSN</span>
                        <strong>{activeCase.ssnLast4 ? `•••-••-${activeCase.ssnLast4}` : 'Not submitted'}</strong>
                      </li>
                      <li>
                        <span>Submitted</span>
                        <strong>{activeCase.submittedAt}</strong>
                      </li>
                      <li>
                        <span>Files</span>
                        <strong>
                          {uploadedDocs.length || activeCase.documents.length} of {activeCase.documents.length}
                        </strong>
                      </li>
                    </ul>
                  </div>

                  <div className="kyc-gallery">
                    {activeCase.documents.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        className={`kyc-gallery-item${doc.id === selectedDoc?.id ? ' active' : ''}`}
                        onClick={() => {
                          setDocId(doc.id)
                          if (doc.src) setLightbox(doc)
                        }}
                      >
                        <DocumentPreview doc={doc} name={activeCase.name} />
                        <span>
                          {doc.label}
                          {doc.src ? ' · View' : ''}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="kyc-preview">
                    <button
                      type="button"
                      className="kyc-main-photo"
                      onClick={() => selectedDoc?.src && setLightbox(selectedDoc)}
                    >
                      {selectedDoc && <DocumentPreview doc={selectedDoc} name={activeCase.name} />}
                    </button>
                    <div>
                      <h3>{selectedDoc?.label}</h3>
                      <p className={`quality ${selectedDoc?.quality}`}>
                        {selectedDoc?.src ? 'Customer upload' : `Quality: ${selectedDoc?.quality}`}
                      </p>
                      {selectedDoc?.src && (
                        <button type="button" className="ghost-btn" onClick={() => setLightbox(selectedDoc)}>
                          View full size
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="kyc-empty">Select an application to review.</p>
          )}
        </section>

        <aside className="kyc-panel">
          {activeCase && (
            <>
              <span className="avatar lg initials">{initials(activeCase.name)}</span>
              <h2>{activeCase.name}</h2>
              <p>{activeCase.email}</p>
              <dl>
                <div>
                  <dt>Phone</dt>
                  <dd>{activeCase.phone}</dd>
                </div>
                <div>
                  <dt>Date of birth</dt>
                  <dd>{activeCase.dob}</dd>
                </div>
                <div>
                  <dt>SSN</dt>
                  <dd>{activeCase.ssnLast4 ? `•••-••-${activeCase.ssnLast4}` : 'Not submitted'}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{activeCase.address}</dd>
                </div>
                <div>
                  <dt>Country</dt>
                  <dd>{activeCase.country}</dd>
                </div>
                <div>
                  <dt>Risk</dt>
                  <dd className={`risk ${activeCase.risk}`}>{activeCase.risk}</dd>
                </div>
              </dl>

              <div className="kyc-link-box">
                <h3>Verification link</h3>
                {link ? (
                  <>
                    <p>{linkExpired ? 'This link has expired.' : 'Customer uses this link to verify with ID, SSN, and selfie.'}</p>
                    <code>{link}</code>
                    <button type="button" className="ghost-btn" onClick={() => copyLink(link)}>
                      {copied === link ? 'Copied' : 'Copy link'}
                    </button>
                  </>
                ) : (
                  <p>No link yet for this application.</p>
                )}
                <button
                  type="button"
                  className="dash-primary"
                  onClick={async () => {
                    const url = await createLinkForCase(activeCase.id, admin.name)
                    if (url) copyLink(url)
                  }}
                >
                  {link ? 'Create new link' : 'Create verification link'}
                </button>
              </div>

              <label className="kyc-note">
                Review note
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add a reason for approve, reject, or more info"
                  rows="3"
                />
              </label>
              <div className="reason-row">
                {REJECT_REASONS.map((reason) => (
                  <button key={reason} type="button" className="chip" onClick={() => setNote(reason)}>
                    {reason}
                  </button>
                ))}
              </div>

              <div className="kyc-actions">
                <button className="resolve-btn" type="button" onClick={() => act('approved')}>
                  Approve KYC
                </button>
                <button className="ghost-btn" type="button" onClick={() => act('more_info')}>
                  Request more info
                </button>
                <button className="danger-btn" type="button" onClick={() => act('rejected')}>
                  Reject
                </button>
              </div>

              <div className="kyc-history">
                <h3>Activity</h3>
                {activeCase.history
                  ?.slice()
                  .reverse()
                  .map((item) => (
                    <p key={item.id}>
                      <strong>{item.by}</strong> {item.text}
                      <small>{item.at}</small>
                    </p>
                  ))}
              </div>
            </>
          )}
        </aside>
      </div>

      {lightbox && (
        <div className="kyc-lightbox" role="dialog" aria-label={lightbox.label} onClick={() => setLightbox(null)}>
          <div className="kyc-lightbox-card" onClick={(event) => event.stopPropagation()}>
            <div className="kyc-lightbox-head">
              <h2>{lightbox.label}</h2>
              <button type="button" className="ghost-btn" onClick={() => setLightbox(null)}>
                Close
              </button>
            </div>
            <img src={lightbox.src} alt={lightbox.label} />
          </div>
        </div>
      )}

      {creating && (
        <div className="kyc-modal" role="dialog" aria-labelledby="kyc-link-title">
          <form className="kyc-modal-card" onSubmit={handleCreate}>
            <h2 id="kyc-link-title">Create verification link</h2>
            <p>The customer will upload ID front and back, enter SSN, and take a live selfie.</p>
            <label>
              Full name
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <label>
              Phone number
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Optional"
              />
            </label>
            {formError && <p className="login-error">{formError}</p>}
            <div className="kyc-modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className="dash-primary" type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create link'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  )
}
