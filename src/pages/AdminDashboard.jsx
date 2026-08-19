import { useEffect, useMemo, useRef, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import ChatThread from '../components/ChatThread'
import ChatInput from '../components/ChatInput'
import { initials, LIVE_CHAT_ID, useChat } from '../context/ChatContext'

const FILTERS = ['all', 'open', 'waiting', 'resolved']

const AGENT_REPLIES = [
  "Thanks for reaching out. I'm looking into this account issue now.",
  'Could you share a screenshot, or the date and amount?',
  "I've reviewed this and flagged it for follow-up on your account.",
  "You're all set. Is there anything else I can help with?",
]

export default function AdminDashboard() {
  const {
    conversations,
    activeId,
    activeConversation,
    sendAdminReply,
    selectConversation,
    setStatus,
    setAgentTyping,
    userTyping,
    agentOnline,
    openCount,
    waitingCount,
    usingSupabase,
  } = useChat()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const threadRef = useRef(null)

  useEffect(() => {
    const thread = threadRef.current
    if (thread) thread.scrollTop = thread.scrollHeight
  }, [activeConversation?.messages, userTyping, activeId])

  const inbox = useMemo(() => {
    const value = query.trim().toLowerCase()
    return conversations.filter((item) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'waiting' ? item.unread > 0 || item.status === 'waiting' : item.status === filter)
      const haystack = `${item.customer.name} ${item.customer.email} ${item.customer.topic} ${item.preview}`.toLowerCase()
      return matchesFilter && (!value || haystack.includes(value))
    })
  }, [conversations, filter, query])

  const customer = activeConversation?.customer
  const lastMessage = activeConversation?.messages.at(-1)

  return (
    <AdminLayout
      title="Support Tickets"
      subtitle={`${openCount} open account chats${agentOnline ? ' · Live with customers' : ''}`}
    >
      <div className="console-grid">
        <aside className="inbox">
          <h2>Inbox</h2>
          <input
            className="inbox-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customers"
            aria-label="Search customers"
          />
          <div className="filter-row">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? 'filter active' : 'filter'}
                onClick={() => setFilter(item)}
              >
                {item}
                {item === 'waiting' && waitingCount > 0 ? ` ${waitingCount}` : ''}
              </button>
            ))}
          </div>
          <div className="inbox-list">
            {inbox.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`inbox-item${item.id === activeId ? ' active' : ''}`}
                onClick={() => selectConversation(item.id)}
              >
                {item.id === LIVE_CHAT_ID ? (
                  <img src="/logo.png" alt="" />
                ) : (
                  <span className="avatar sm initials">{initials(item.customer.name)}</span>
                )}
                <span>
                  <strong>
                    {item.customer.name}
                    {item.unread > 0 && <em className="unread">{item.unread}</em>}
                  </strong>
                  <small>{item.preview}</small>
                </span>
                <b className={`status-dot ${item.status}`} />
              </button>
            ))}
            {inbox.length === 0 && (
              <p className="empty-inbox">
                {conversations.length === 0
                  ? 'No customer account chats yet'
                  : 'No matching chats'}
              </p>
            )}
          </div>
        </aside>

        {activeConversation && customer ? (
          <>
            <section className="admin-chat">
              <div className="admin-chat-head">
                <div>
                  <h2>{customer.name}</h2>
                  <p>{customer.topic}</p>
                </div>
                <select
                  className="status-select"
                  value={activeConversation.status}
                  onChange={(event) => setStatus(activeId, event.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="waiting">Waiting</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <p className="live-hint">
                {usingSupabase || activeId === LIVE_CHAT_ID
                  ? 'Realtime chat — new messages appear as they are sent.'
                  : 'Open /chat to talk with this customer.'}
              </p>
              <ChatThread
                messages={activeConversation.messages}
                typing={userTyping}
                threadRef={threadRef}
                perspective="admin"
                customerName={customer.name}
              />
              <ChatInput
                placeholder="Reply as Chime..."
                quickReplies={AGENT_REPLIES}
                onTyping={setAgentTyping}
                onSend={(payload) => sendAdminReply(activeId, payload)}
                onQuickReply={(text) => sendAdminReply(activeId, { text, attachments: [] })}
              />
            </section>

            <aside className="customer-panel">
              <span className="avatar lg initials">{initials(customer.name)}</span>
              <h2>{customer.name}</h2>
              <p>{customer.email}</p>
              <dl>
                <div>
                  <dt>Topic</dt>
                  <dd>{customer.topic}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{customer.phone || '—'}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd className={`status-text ${activeConversation.status}`}>{activeConversation.status}</dd>
                </div>
                <div>
                  <dt>Member since</dt>
                  <dd>{customer.memberSince || '—'}</dd>
                </div>
                <div>
                  <dt>Messages</dt>
                  <dd>{activeConversation.messages.length}</dd>
                </div>
                <div>
                  <dt>Last activity</dt>
                  <dd>{lastMessage?.time || '—'}</dd>
                </div>
              </dl>
              <button
                className="resolve-btn"
                type="button"
                onClick={() =>
                  setStatus(activeId, activeConversation.status === 'resolved' ? 'open' : 'resolved')
                }
              >
                {activeConversation.status === 'resolved' ? 'Reopen chat' : 'Mark resolved'}
              </button>
            </aside>
          </>
        ) : (
          <section className="admin-chat empty-ticket">
            <h2>Waiting for customers</h2>
            <p>
              When someone starts a chat about an account issue, the ticket opens here so you can reply in
              real time.
            </p>
          </section>
        )}
      </div>
    </AdminLayout>
  )
}
