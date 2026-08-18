import { useState } from 'react'
import { Link, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { useKyc } from '../context/KycContext'
import { useNotifications } from '../context/NotificationContext'
import { LogoutIcon, MailIcon } from './icons'
import { IconBell, IconMenu, IconSearch, IconShield, IconTicket, IconUsers } from './adminIcons'

const MAIN_LINKS = [
  { to: '/admin/users', label: 'Users', icon: <IconUsers /> },
  { to: '/admin/tickets', label: 'Support Tickets', icon: <IconTicket /> },
  { to: '/admin/kyc', label: 'KYC Management', icon: <IconShield /> },
  { to: '/admin/notifications', label: 'Email Notifications', icon: <MailIcon /> },
]

function initials(name = 'AU') {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function NavItem({ to, label, icon, end, badge, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) => (isActive ? 'active' : undefined)}
    >
      {icon}
      <span>{label}</span>
      {badge > 0 && <em className="unread">{badge}</em>}
    </NavLink>
  )
}

export default function AdminLayout({ title, subtitle, children, actions }) {
  const { admin, isAuthenticated, ready, logout } = useAuth()
  const { waitingCount } = useChat()
  const { counts } = useKyc()
  const { unreadCount, toast, clearToast, markRead } = useNotifications()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  if (!ready) return null

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }

  async function handleLogout() {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  function toggleNav() {
    if (window.matchMedia('(max-width: 760px)').matches) {
      setNavOpen((open) => !open)
      return
    }
    setCollapsed((value) => !value)
  }

  return (
    <div className={`admin-console dash-shell${navOpen ? ' nav-open' : ''}${collapsed ? ' nav-collapsed' : ''}`}>
      {navOpen && (
        <button type="button" className="dash-backdrop" onClick={() => setNavOpen(false)} aria-label="Close menu" />
      )}
      <aside className="admin-sidebar dash-sidebar">
        <Link to="/admin/tickets" className="sidebar-brand dash-brand" onClick={() => setNavOpen(false)}>
          <img src="/logo.png" alt="" />
          <span>
            <b>chime</b>
            <small>Admin Dashboard</small>
          </span>
        </Link>

        <nav className="sidebar-menu dash-nav">
          {MAIN_LINKS.map((item) => (
            <NavItem
              key={item.to}
              {...item}
              badge={
                item.to === '/admin/notifications'
                  ? unreadCount
                  : item.to === '/admin/tickets'
                    ? waitingCount
                    : item.to === '/admin/kyc'
                      ? counts.pending + counts.review
                      : 0
              }
              onClick={() => setNavOpen(false)}
            />
          ))}
        </nav>

        <div className="sidebar-foot dash-foot">
          <div className="sidebar-user">
            <span className="dash-avatar">{initials(admin.name)}</span>
            <span>
              <strong>{admin.name}</strong>
              <small>Super Admin</small>
            </span>
          </div>
          <button type="button" onClick={handleLogout}>
            <LogoutIcon /> Log Out
          </button>
        </div>
      </aside>

      <div className="admin-main dash-main">
        <header className="dash-topbar">
          <button
            type="button"
            className="dash-hamburger"
            aria-label="Open menu"
            onClick={toggleNav}
          >
            <IconMenu />
          </button>
          <label className="dash-search">
            <IconSearch />
            <input placeholder="Search here..." />
          </label>
          <button
            className="dash-bell"
            type="button"
            aria-label="Notifications"
            onClick={() => navigate('/admin/notifications')}
          >
            <IconBell />
            {unreadCount > 0 && <em>{unreadCount}</em>}
          </button>
          <div className="dash-profile">
            <span className="dash-avatar">{initials(admin.name)}</span>
            <span>
              <strong>{admin.name}</strong>
              <small>Super Admin</small>
            </span>
          </div>
        </header>

        <div className="dash-pagehead">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </div>

        <div className="dash-content">{children}</div>
      </div>

      {toast && (
        <button
          type="button"
          className="mail-toast"
          onClick={() => {
            markRead(toast.id)
            clearToast()
            navigate(toast.href || '/admin/notifications')
          }}
        >
          <MailIcon />
          <span>
            <strong>{toast.subject}</strong>
            <small>{toast.preview}</small>
          </span>
        </button>
      )}
    </div>
  )
}
