import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { useAuth } from '../context/AuthContext'
import { initials, useChat } from '../context/ChatContext'
import { useKyc } from '../context/KycContext'
import { useUsers } from '../context/UserContext'

const STATUS_FILTERS = ['all', 'active', 'review', 'inactive']
const ROLE_FILTERS = ['all', 'Customer', 'Admin']

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  status: 'active',
  role: 'Customer',
  password: '',
}

function sourceLabel(source) {
  if (source === 'chat') return 'Chat'
  if (source === 'kyc') return 'KYC'
  if (source === 'admin') return 'Admin'
  return 'Manual'
}

function UserForm({ title, copy, form, setForm, error, saving, onCancel, onSubmit, submitLabel }) {
  return (
    <div className="kyc-modal" role="dialog" aria-labelledby="user-form-title">
      <form className="kyc-modal-card" onSubmit={onSubmit}>
        <h2 id="user-form-title">{title}</h2>
        <p>{copy}</p>
        <label>
          Full name
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Jane Doe"
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="jane@email.com"
            required
          />
        </label>
        <label>
          Phone number
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            placeholder="(555) 123-4567"
          />
        </label>
        <label>
          Role
          <select
            value={form.role}
            onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
          >
            <option>Customer</option>
            <option>Admin</option>
          </select>
        </label>
        <label>
          Status
          <select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
          >
            <option value="active">Active</option>
            <option value="review">Review</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        {form.role === 'Admin' && (
          <label>
            Dashboard password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="At least 6 characters"
              minLength={form.password ? 6 : undefined}
            />
          </label>
        )}
        {error && <p className="login-error">{error}</p>}
        <div className="kyc-modal-actions">
          <button type="button" className="ghost-btn" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className="dash-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const { admin } = useAuth()
  const { conversations } = useChat()
  const { cases, createVerificationLink } = useKyc()
  const {
    users,
    loading,
    error: loadError,
    createUser,
    updateUser,
    setUserStatus,
    grantAdminAccess,
    revokeAdminAccess,
    deleteUser,
    counts,
  } = useUsers()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const selected = users.find((item) => item.id === selectedId) || users[0] || null

  const list = useMemo(() => {
    const value = query.trim().toLowerCase()
    return users.filter((item) => {
      const matchesStatus = filter === 'all' || item.status === filter
      const matchesRole = roleFilter === 'all' || item.role === roleFilter
      const haystack = `${item.name} ${item.email} ${item.phone} ${item.role} ${item.source}`.toLowerCase()
      return matchesStatus && matchesRole && (!value || haystack.includes(value))
    })
  }, [users, query, filter, roleFilter])

  const ticketCount = conversations.filter(
    (item) => item.customer?.email && item.customer.email === selected?.email,
  ).length
  const kycCase = cases.find((item) => item.email === selected?.email)

  function openCreate() {
    setForm(emptyForm)
    setError('')
    setModal('create')
  }

  function openEdit(user) {
    setSelectedId(user.id)
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone === '—' ? '' : user.phone,
      status: user.status,
      role: user.role,
      password: '',
    })
    setError('')
    setModal('edit')
  }

  async function handleCreate(event) {
    event.preventDefault()
    setSaving(true)
    const result = await createUser({ ...form, createdBy: admin?.id })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setModal(null)
    setError('')
    setNotice(`${result.user.name} was added.`)
    setSelectedId(result.user.id)
  }

  async function handleEdit(event) {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    const result = await updateUser(selected.id, form)
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setModal(null)
    setError('')
    setNotice(`${form.name} was updated.`)
  }

  async function handleDelete(user) {
    if (!window.confirm(`Delete ${user.name}? This cannot be undone.`)) return
    const result = await deleteUser(user.id)
    if (!result.ok) {
      setNotice(result.error)
      return
    }
    setNotice(`${user.name} was deleted.`)
    if (selectedId === user.id) setSelectedId(null)
  }

  async function handleGrant(user) {
    const password = window.prompt(`Set a dashboard password for ${user.email}`)
    if (!password) return
    const result = await grantAdminAccess(user.id, password)
    setNotice(result.ok ? `${user.name} can now sign in at /admin/login.` : result.error)
  }

  async function handleRevoke(user) {
    if (!window.confirm(`Remove dashboard access for ${user.name}?`)) return
    const result = await revokeAdminAccess(user.id)
    setNotice(result.ok ? `${user.name} can no longer sign in to admin.` : result.error)
  }

  async function handleKycLink(user) {
    try {
      const created = await createVerificationLink(
        { name: user.name, email: user.email, phone: user.phone === '—' ? '' : user.phone },
        admin?.name,
      )
      setNotice(created ? `KYC link created for ${user.name}.` : 'Enter a name and email first.')
      if (created) navigate('/admin/kyc')
    } catch (kycError) {
      setNotice(kycError.message || 'Could not create a KYC link.')
    }
  }

  return (
    <AdminLayout
      title="Users"
      subtitle={`${counts.total} people in the workspace.`}
      actions={
        <button className="dash-primary" type="button" onClick={openCreate}>
          + Create user
        </button>
      }
    >
      <div className="kyc-stats">
        <article>
          <span>Total</span>
          <strong>{counts.total}</strong>
        </article>
        <article>
          <span>Active</span>
          <strong>{counts.active}</strong>
        </article>
        <article>
          <span>Review</span>
          <strong>{counts.review}</strong>
        </article>
        <article>
          <span>Admins</span>
          <strong>{counts.admins}</strong>
        </article>
      </div>

      {(loadError || notice) && (
        <p className={loadError ? 'login-error' : 'login-copy'}>{loadError || notice}</p>
      )}

      <div className="users-grid">
        <section className="dash-card">
          <div className="card-toolbar">
            <input
              className="inbox-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email, or phone"
              aria-label="Search users"
            />
            <div className="filter-row">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={filter === item ? 'filter active' : 'filter'}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="filter-row">
              {ROLE_FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={roleFilter === item ? 'filter active' : 'filter'}
                  onClick={() => setRoleFilter(item)}
                >
                  {item === 'all' ? 'all roles' : item}
                </button>
              ))}
            </div>
          </div>
          <div className="table-scroll">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="7">Loading users...</td>
                  </tr>
                )}
                {!loading &&
                  list.map((item) => (
                    <tr
                      key={item.id}
                      className={item.id === selected?.id ? 'selected' : undefined}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <td>
                        <div className="template-name">
                          <span className="avatar sm initials">{initials(item.name)}</span>
                          <strong>{item.name}</strong>
                        </div>
                      </td>
                      <td>{item.email}</td>
                      <td>{item.phone}</td>
                      <td>
                        {item.role}
                        {item.canLogin ? ' · login' : ''}
                      </td>
                      <td>{sourceLabel(item.source)}</td>
                      <td>
                        <select
                          className={`status-badge ${item.status}`}
                          value={item.status}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => setUserStatus(item.id, event.target.value)}
                          aria-label={`Status for ${item.name}`}
                        >
                          <option value="active">active</option>
                          <option value="review">review</option>
                          <option value="inactive">inactive</option>
                        </select>
                      </td>
                      <td>{item.joined}</td>
                    </tr>
                  ))}
                {!loading && list.length === 0 && (
                  <tr>
                    <td colSpan="7">
                      {users.length === 0
                        ? 'No users yet. Create one, or they will appear when a customer starts chat or KYC.'
                        : 'No users match that search.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selected && (
          <aside className="dash-card padded user-detail">
            <div className="template-name">
              <span className="avatar sm initials">{initials(selected.name)}</span>
              <div>
                <h2>{selected.name}</h2>
                <p className="login-copy">{selected.email}</p>
              </div>
            </div>
            <dl className="user-meta">
              <div>
                <dt>Phone</dt>
                <dd>{selected.phone}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>
                  {selected.role}
                  {selected.canLogin ? ' · can sign in' : ''}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{selected.status}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{sourceLabel(selected.source)}</dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd>{selected.joined}</dd>
              </div>
              <div>
                <dt>Tickets</dt>
                <dd>{ticketCount}</dd>
              </div>
              <div>
                <dt>KYC</dt>
                <dd>{kycCase ? kycCase.status.replace('_', ' ') : 'None'}</dd>
              </div>
            </dl>
            <div className="user-actions">
              <button type="button" className="ghost-btn" onClick={() => openEdit(selected)}>
                Edit user
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => navigate(`/admin/notifications/create?email=${encodeURIComponent(selected.email)}`)}
              >
                Send email
              </button>
              <button type="button" className="ghost-btn" onClick={() => handleKycLink(selected)}>
                Create KYC link
              </button>
              {ticketCount > 0 && (
                <button type="button" className="ghost-btn" onClick={() => navigate('/admin/tickets')}>
                  Open tickets
                </button>
              )}
              {kycCase && (
                <button type="button" className="ghost-btn" onClick={() => navigate('/admin/kyc')}>
                  Open KYC
                </button>
              )}
              {selected.role === 'Admin' && !selected.canLogin && (
                <button type="button" className="ghost-btn" onClick={() => handleGrant(selected)}>
                  Grant dashboard login
                </button>
              )}
              {selected.canLogin && selected.adminUserId !== admin?.id && (
                <button type="button" className="ghost-btn" onClick={() => handleRevoke(selected)}>
                  Revoke dashboard login
                </button>
              )}
              {selected.adminUserId !== admin?.id && (
                <button type="button" className="danger-btn" onClick={() => handleDelete(selected)}>
                  Delete user
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      {modal === 'create' && (
        <UserForm
          title="Create user"
          copy="Add a customer to the directory, or create an admin who can sign in."
          form={form}
          setForm={setForm}
          error={error}
          saving={saving}
          onCancel={() => setModal(null)}
          onSubmit={handleCreate}
          submitLabel="Create user"
        />
      )}
      {modal === 'edit' && (
        <UserForm
          title="Edit user"
          copy="Update this profile. Set a password to give an admin dashboard access."
          form={form}
          setForm={setForm}
          error={error}
          saving={saving}
          onCancel={() => setModal(null)}
          onSubmit={handleEdit}
          submitLabel="Save changes"
        />
      )}
    </AdminLayout>
  )
}
