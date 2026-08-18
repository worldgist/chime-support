import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { LIVE_CUSTOMER_EMAIL, useNotifications } from '../context/NotificationContext'
import { BackIcon, MailIcon, MenuIcon } from './icons'

function forLiveCustomer(email, visitorEmail) {
  return (
    email.toAll ||
    email.recipients?.some((item) => item.email === visitorEmail || item.email === LIVE_CUSTOMER_EMAIL) ||
    email.to === visitorEmail ||
    email.to === LIVE_CUSTOMER_EMAIL
  )
}

export default function Header() {
  const { isAuthenticated } = useAuth()
  const { visitor } = useChat()
  const { userEmails, markUserRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [activeMail, setActiveMail] = useState(null)
  const menuRef = useRef(null)

  const myEmails = userEmails.filter((email) => forLiveCustomer(email, visitor?.email))
  const unread = myEmails.filter((item) => !item.read).length

  useEffect(() => {
    function handleClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
        setInboxOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function openMail(email) {
    setActiveMail(email)
    markUserRead(email.id)
  }

  return (
    <header className="header chat-header">
      <Link className="icon-btn" to="/" aria-label="Go back">
        <BackIcon />
      </Link>
      <img className="brand-logo" src="/logo.png" alt="Chime" />
      <div className="header-actions" ref={menuRef}>
        <button
          className="icon-btn mail-btn"
          type="button"
          aria-label="Email notifications"
          onClick={() => {
            setInboxOpen((value) => !value)
            setOpen(false)
            setActiveMail(null)
          }}
        >
          <MailIcon />
          {unread > 0 && <em className="unread">{unread}</em>}
        </button>
        <button
          className="icon-btn"
          type="button"
          aria-label="More options"
          onClick={() => {
            setOpen((value) => !value)
            setInboxOpen(false)
          }}
        >
          <MenuIcon />
        </button>
        {open && (
          <nav className="menu-dropdown">
            <Link to={isAuthenticated ? '/admin/tickets' : '/admin/login'} onClick={() => setOpen(false)}>
              {isAuthenticated ? 'Admin chat support' : 'Admin login'}
            </Link>
            {isAuthenticated && (
              <>
                <Link to="/admin/kyc" onClick={() => setOpen(false)}>
                  KYC management
                </Link>
                <Link to="/admin/notifications" onClick={() => setOpen(false)}>
                  Email notifications
                </Link>
              </>
            )}
          </nav>
        )}
        {inboxOpen && (
          <div className="user-inbox">
            <h2>Your emails</h2>
            {activeMail ? (
              <div className="user-mail">
                <button type="button" className="text-link-btn" onClick={() => setActiveMail(null)}>
                  Back
                </button>
                <h3>{activeMail.subject}</h3>
                <p className="mail-to">{activeMail.from}</p>
                {activeMail.body.split('\n').map((line, index) => (
                  <p key={`${activeMail.id}-${index}`}>{line || '\u00a0'}</p>
                ))}
              </div>
            ) : myEmails.length === 0 ? (
              <p className="empty-inbox">No emails yet.</p>
            ) : (
              myEmails.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`user-mail-item${item.read ? '' : ' unread-mail'}`}
                  onClick={() => openMail(item)}
                >
                  <strong>{item.subject}</strong>
                  <small>{item.preview}</small>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </header>
  )
}
