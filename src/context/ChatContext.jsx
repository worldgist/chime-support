import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  ADMIN_ONLINE_KEY,
  CONVERSATIONS_KEY,
  createChatChannel,
  formatTime,
  isAdminOnline,
  loadConversations,
  loadVisitor,
  saveConversations,
  saveVisitor,
} from '../utils/chatStore'
import {
  createSupportTicket,
  fetchAdminTickets,
  fetchCustomerThread,
  markTicketRead,
  sendAdminMessage,
  sendCustomerMessage,
  updateTicketStatus,
} from '../utils/supportTickets'
import { persistChatAttachments } from '../utils/chatStorage'
import { toLocalAttachment } from '../utils/attachments'

const ChatContext = createContext(null)
export const LIVE_CHAT_ID = 'live'
export { formatTime }

export const RESOLVED_NOTICE =
  'Your issue has been marked as resolved. If you still need help, send another message and we will reopen this chat.'

export function isResolvedNotice(message) {
  return message?.event === 'resolved' || message?.text === RESOLVED_NOTICE
}

const starterMessages = [
  {
    id: 1,
    from: 'support',
    text: 'Hi there! 👋 Thanks for reaching out to Chime Support. How can I help you today?',
    time: '10:30 AM',
  },
  {
    id: 2,
    from: 'user',
    text: 'Hi, I have a question about a recent transaction on my account.',
    time: '10:31 AM',
  },
  {
    id: 3,
    from: 'support',
    text: 'Sure! I’d be happy to help you with that. You can send a screenshot, photo, or statement and I’ll take a look.',
    time: '10:31 AM',
  },
]

const replies = [
  'Thanks for sharing that. I can look up the transaction if you send the date and amount.',
  'I’ve found a matching activity on your account. Would you like me to explain the charge?',
  'You’re all set — I’ve flagged this for review. Anything else I can help with today?',
  'Got it. A specialist can follow up if this needs more time. Is there another question I can answer?',
]

const initialConversations = [
  {
    id: LIVE_CHAT_ID,
    customer: {
      name: 'Live customer',
      email: 'guest@chimesupport.local',
      phone: '',
      topic: 'Recent transaction',
      memberSince: '2024',
    },
    status: 'open',
    unread: 0,
    messages: starterMessages,
  },
  {
    id: 'jordan',
    customer: {
      name: 'Jordan Lee',
      email: 'jordan.lee@email.com',
      topic: 'Card declined',
      memberSince: '2023',
    },
    status: 'waiting',
    unread: 1,
    messages: [
      {
        id: 11,
        from: 'user',
        text: 'My Chime card was declined at the grocery store.',
        time: '9:12 AM',
      },
      {
        id: 12,
        from: 'support',
        text: 'Sorry about that — I can check the card status. Was this a debit purchase?',
        time: '9:14 AM',
      },
      {
        id: 13,
        from: 'user',
        text: 'Yes, $64.20 at FreshMart.',
        time: '9:16 AM',
      },
    ],
  },
  {
    id: 'sam',
    customer: {
      name: 'Sam Rivera',
      email: 'sam.rivera@email.com',
      topic: 'Direct deposit',
      memberSince: '2022',
    },
    status: 'open',
    unread: 0,
    messages: [
      {
        id: 21,
        from: 'user',
        text: 'When will my paycheck hit my Chime account?',
        time: '8:05 AM',
      },
      {
        id: 22,
        from: 'support',
        text: 'Direct deposits often arrive up to 2 days early. I can look up the expected date if you share your employer name.',
        time: '8:07 AM',
      },
    ],
  },
  {
    id: 'taylor',
    customer: {
      name: 'Taylor Brooks',
      email: 'taylor.brooks@email.com',
      topic: 'Account access',
      memberSince: '2025',
    },
    status: 'resolved',
    unread: 0,
    messages: [
      {
        id: 31,
        from: 'user',
        text: 'I got locked out after too many password attempts.',
        time: 'Yesterday',
      },
      {
        id: 32,
        from: 'support',
        text: 'I reset the lock and sent a sign-in email. You should be able to get back in now.',
        time: 'Yesterday',
      },
      {
        id: 33,
        from: 'user',
        text: 'That worked. Thank you!',
        time: 'Yesterday',
      },
    ],
  },
]

function previewOf(conversation) {
  const last = conversation.messages.at(-1)
  if (!last) return 'New conversation'
  return last.text || last.attachments?.[0]?.name || 'Attachment'
}

function pickReply({ text, attachments }, turn) {
  const lower = text.toLowerCase()
  const hasImage = attachments.some((item) => item.type === 'image')
  const hasFile = attachments.some((item) => item.type === 'file')

  if (hasImage && hasFile) {
    return 'Thanks — I received your photo and file. I’ll review both and follow up shortly.'
  }
  if (hasImage) {
    return 'Thanks for the photo. I can see the details — give me a moment to review them.'
  }
  if (hasFile) {
    return 'I’ve received your file. I’ll review it and get back to you with next steps.'
  }
  if (lower.includes('screenshot') || lower.includes('statement') || lower.includes('file')) {
    return 'Perfect. Use the paperclip to upload a photo or file, then send it over whenever you’re ready.'
  }
  if (lower.includes('locked') || lower.includes('sign in') || lower.includes('password') || lower.includes('access')) {
    return 'I can help with account access. Tell me what you see when you try to sign in, and I’ll walk you through the next step.'
  }
  if (lower.includes('transaction') || lower.includes('charge') || lower.includes('payment')) {
    return 'I can help with that transaction. Please share the date, amount, and merchant name if you have them.'
  }
  if (lower.includes('card') || lower.includes('debit')) {
    return 'I can help with your Chime card. Are you asking about a purchase, a freeze, or a replacement?'
  }
  if (lower.includes('thank')) {
    return 'Happy to help! If anything else comes up, we’re here 24/7.'
  }
  return replies[turn % replies.length]
}

function patchConversation(list, id, patch) {
  return list.map((conversation) =>
    conversation.id === id ? { ...conversation, ...patch(conversation) } : conversation,
  )
}

function upsertConversation(list, thread) {
  const exists = list.some((item) => item.id === thread.id)
  if (!exists) return [thread, ...list]
  return list.map((item) => (item.id === thread.id ? mergeThread(item, thread) : item))
}

function mergeThread(existing, incoming) {
  const incomingCount = incoming.messages?.length || 0
  const existingCount = existing.messages?.length || 0
  if (incomingCount >= existingCount) return { ...existing, ...incoming }
  return { ...existing, ...incoming, messages: existing.messages }
}

function mergeIncomingTickets(current, incoming, visitorTicketId) {
  const currentById = new Map(current.map((item) => [item.id, item]))
  const merged = incoming.map((ticket) => {
    const existing = currentById.get(ticket.id)
    return existing ? mergeThread(existing, ticket) : ticket
  })
  const incomingIds = new Set(incoming.map((item) => item.id))
  const extras = current.filter(
    (item) => item.id === visitorTicketId && item.id !== LIVE_CHAT_ID && !incomingIds.has(item.id),
  )
  return extras.length ? [...merged, ...extras] : merged
}

function appendMessage(list, ticketId, message, customer) {
  const existing = list.find((item) => item.id === ticketId)
  if (!existing) {
    return [
      {
        id: ticketId,
        customer: {
          name: customer?.name || 'Customer',
          email: customer?.email || '',
          phone: customer?.phone || '',
          topic: customer?.topic || 'Account issue',
          memberSince: String(new Date().getFullYear()),
        },
        status: 'open',
        unread: 1,
        messages: [message],
      },
      ...list,
    ]
  }
  if (existing.messages.some((item) => String(item.id) === String(message.id))) return list
  return patchConversation(list, ticketId, (conversation) => ({
    status: conversation.status === 'resolved' ? 'open' : conversation.status,
    unread: 1,
    messages: [...conversation.messages, message],
  }))
}

export function ChatProvider({ children }) {
  const usingSupabase = Boolean(supabase)
  const [conversations, setConversations] = useState(() =>
    usingSupabase ? [] : loadConversations(initialConversations),
  )
  const [activeId, setActiveId] = useState(usingSupabase ? null : LIVE_CHAT_ID)
  const [botTyping, setBotTyping] = useState(false)
  const [agentTyping, setAgentTypingState] = useState(false)
  const [userTyping, setUserTypingState] = useState(false)
  const [agentOnline, setAgentOnline] = useState(() => isAdminOnline())
  const [visitor, setVisitor] = useState(() => loadVisitor())
  const turnRef = useRef(0)
  const replyTimer = useRef(null)
  const activeIdRef = useRef(activeId)
  const skipPublish = useRef(true)
  const channelRef = useRef(null)
  const agentOnlineRef = useRef(agentOnline)
  const visitorRef = useRef(visitor)
  const usingSupabaseRef = useRef(usingSupabase)
  const adminFetchRef = useRef(0)
  activeIdRef.current = activeId
  agentOnlineRef.current = agentOnline
  visitorRef.current = visitor
  usingSupabaseRef.current = usingSupabase

  const live =
    conversations.find((item) => item.id === visitor?.ticketId) ||
    conversations.find((item) => item.id === LIVE_CHAT_ID)

  function publish(nextConversations) {
    const payload = saveConversations(nextConversations)
    channelRef.current?.postMessage({ type: 'conversations', ...payload })
  }

  function applyConversations(next) {
    skipPublish.current = true
    setConversations(next)
  }

  async function refreshAdminTickets() {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    if (!data.session) return
    const requestId = ++adminFetchRef.current
    const tickets = await fetchAdminTickets()
    if (requestId !== adminFetchRef.current) return
    setConversations((current) => mergeIncomingTickets(current, tickets, visitorRef.current?.ticketId))
    setActiveId((id) => {
      if (id && tickets.some((item) => item.id === id)) return id
      return tickets[0]?.id || id || null
    })
  }

  async function refreshCustomerThread() {
    const profile = visitorRef.current
    if (!supabase || !profile?.ticketId || !profile?.ticketToken) return
    const thread = await fetchCustomerThread(profile.ticketId, profile.ticketToken)
    setConversations((current) => upsertConversation(current, thread))
  }

  useEffect(() => {
    const channel = createChatChannel()
    channelRef.current = channel

    function onMessage(event) {
      const data = event.data
      if (!data?.type) return
      if (data.type === 'conversations' && Array.isArray(data.conversations) && !usingSupabaseRef.current) {
        const next = data.conversations.map((item) =>
          item.id === LIVE_CHAT_ID && activeIdRef.current === LIVE_CHAT_ID
            ? { ...item, unread: 0 }
            : item,
        )
        applyConversations(next)
      }
      if (data.type === 'typing') {
        if (data.role === 'user') setUserTypingState(Boolean(data.value))
        if (data.role === 'agent') setAgentTypingState(Boolean(data.value))
      }
      if (data.type === 'admin-online') {
        setAgentOnline(Boolean(data.online))
      }
      if (data.type === 'ticket-upsert' && data.thread?.id) {
        setConversations((current) => upsertConversation(current, data.thread))
        setActiveId((id) => id || data.thread.id)
      }
      if (data.type === 'ticket-message' && data.ticketId && data.message) {
        setConversations((current) => appendMessage(current, data.ticketId, data.message, data.customer))
      }
      if (data.type === 'ticket-status' && data.id) {
        setConversations((current) => {
          if (!current.some((item) => item.id === data.id)) return current
          return patchConversation(current, data.id, (conversation) => {
            const notice = data.message
            const already = notice && isResolvedNotice(conversation.messages.at(-1))
            return {
              status: data.status,
              messages: notice && !already ? [...conversation.messages, notice] : conversation.messages,
            }
          })
        })
      }
    }

    function onStorage(event) {
      if (event.key === ADMIN_ONLINE_KEY) {
        setAgentOnline(event.newValue === '1')
      }
      if (event.key === CONVERSATIONS_KEY && event.newValue && !usingSupabaseRef.current) {
        try {
          const parsed = JSON.parse(event.newValue)
          if (Array.isArray(parsed?.conversations)) applyConversations(parsed.conversations)
        } catch {
          // ignore malformed storage
        }
      }
    }

    channel?.addEventListener('message', onMessage)
    window.addEventListener('storage', onStorage)
    return () => {
      channel?.removeEventListener('message', onMessage)
      channel?.close()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    if (skipPublish.current) {
      skipPublish.current = false
      return
    }
    if (usingSupabase) return
    publish(conversations)
  }, [conversations, usingSupabase])

  useEffect(() => {
    if (!supabase) return undefined
    let cancelled = false

    async function load() {
      try {
        await refreshAdminTickets()
      } catch {
        // Tables or session may not be ready yet.
      }
    }

    load()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (session) load()
    })

    const realtime = supabase
      .channel('support-ticket-chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_ticket_messages' }, load)
      .subscribe()

    const poll = window.setInterval(load, 4000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      supabase.removeChannel(realtime)
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !visitor?.ticketId || !visitor?.ticketToken) return undefined
    let cancelled = false

    async function load() {
      try {
        if (!cancelled) await refreshCustomerThread()
      } catch {
        // Ticket token may be stale until the customer starts a new chat.
      }
    }

    load()
    const poll = window.setInterval(load, 2500)
    return () => {
      cancelled = true
      window.clearInterval(poll)
    }
  }, [visitor?.ticketId, visitor?.ticketToken])

  async function startLiveChat(details) {
    const profile = {
      name: details.name.trim(),
      email: details.email.trim().toLowerCase(),
      phone: details.phone.trim(),
      topic: (details.topic || 'Account issue').trim() || 'Account issue',
    }
    if (!profile.name || !profile.email || !profile.phone) {
      return { ok: false, error: 'Please fill in your full name, email, and phone number.' }
    }

    if (supabase) {
      try {
        const created = await createSupportTicket(profile)
        const next = {
          ...profile,
          ticketId: created.id,
          ticketToken: created.access_token,
          topic: created.topic || profile.topic,
        }
        saveVisitor(next)
        setVisitor(next)
        const thread = await fetchCustomerThread(created.id, created.access_token)
        setConversations((current) => upsertConversation(current, thread))
        setActiveId(thread.id)
        channelRef.current?.postMessage({ type: 'ticket-upsert', thread })
        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          error: error.message || 'Could not start chat. Try again in a moment.',
        }
      }
    }

    saveVisitor(profile)
    setVisitor(profile)

    const firstName = profile.name.split(' ')[0]
    const greeting = {
      id: Date.now(),
      from: 'support',
      text: `Hi ${firstName}! Thanks for reaching out about your account. A specialist will chat with you here.`,
      time: formatTime(),
    }

    setConversations((current) =>
      patchConversation(current, LIVE_CHAT_ID, (conversation) => {
        const sameVisitor = conversation.customer.email === profile.email
        return {
          status: 'open',
          unread: 0,
          customer: {
            ...conversation.customer,
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            topic: profile.topic,
          },
          messages: sameVisitor && conversation.messages.length > 0 ? conversation.messages : [greeting],
        }
      }),
    )
    return { ok: true }
  }

  async function sendUserMessage({ text, attachments = [] }) {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return { ok: false, error: 'Type a message or attach a file.' }

    const ticketId = visitorRef.current?.ticketId || LIVE_CHAT_ID
    const profile = visitorRef.current
    let stored = attachments

    if (supabase && visitorRef.current?.ticketId && visitorRef.current?.ticketToken) {
      try {
        stored = await persistChatAttachments(visitorRef.current.ticketId, attachments)
      } catch (uploadError) {
        return { ok: false, error: uploadError.message || 'Could not save that photo or file.' }
      }
    } else {
      stored = await Promise.all(attachments.map((item) => toLocalAttachment(item)))
    }

    const message = {
      id: Date.now(),
      from: 'user',
      text: trimmed,
      time: formatTime(),
      attachments: stored,
    }

    setConversations((current) => {
      const existing = current.find((item) => item.id === ticketId)
      if (!existing) {
        return [
          {
            id: ticketId,
            customer: {
              name: profile?.name || 'Customer',
              email: profile?.email || '',
              phone: profile?.phone || '',
              topic: profile?.topic || 'Account issue',
              memberSince: String(new Date().getFullYear()),
            },
            status: 'open',
            unread: 1,
            messages: [message],
          },
          ...current,
        ]
      }
      return patchConversation(current, ticketId, (conversation) => ({
        status: conversation.status === 'resolved' ? 'open' : conversation.status,
        unread: agentOnlineRef.current && activeIdRef.current !== ticketId ? conversation.unread + 1 : 1,
        messages: [...conversation.messages, message],
      }))
    })

    if (supabase && visitorRef.current?.ticketId && visitorRef.current?.ticketToken) {
      try {
        const saved = await sendCustomerMessage(visitorRef.current.ticketId, visitorRef.current.ticketToken, {
          text: trimmed,
          attachments: stored,
        })
        channelRef.current?.postMessage({
          type: 'ticket-message',
          ticketId,
          message: saved,
          customer: profile,
        })
        await refreshCustomerThread()
      } catch (sendError) {
        setConversations((current) =>
          patchConversation(current, ticketId, (conversation) => ({
            messages: conversation.messages.filter((item) => item.id !== message.id),
          })),
        )
        return { ok: false, error: sendError.message || 'Could not send that message.' }
      }
      return { ok: true }
    }

    if (agentOnlineRef.current) {
      setBotTyping(false)
      window.clearTimeout(replyTimer.current)
      return { ok: true }
    }

    setBotTyping(true)
    const reply = pickReply({ text: trimmed, attachments: stored }, turnRef.current)
    turnRef.current += 1
    window.clearTimeout(replyTimer.current)

    replyTimer.current = window.setTimeout(() => {
      setBotTyping(false)
      setConversations((current) =>
        patchConversation(current, LIVE_CHAT_ID, (conversation) => ({
          messages: [
            ...conversation.messages,
            { id: Date.now() + 1, from: 'support', text: reply, time: formatTime() },
          ],
        })),
      )
    }, 1100)
    return { ok: true }
  }

  async function sendAdminReply(conversationId, { text, attachments = [] }) {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return { ok: false, error: 'Type a message or attach a file.' }
    window.clearTimeout(replyTimer.current)
    setBotTyping(false)
    setAgentTypingState(false)
    channelRef.current?.postMessage({ type: 'typing', role: 'agent', value: false })

    let stored = attachments
    if (supabase && conversationId && conversationId !== LIVE_CHAT_ID) {
      try {
        stored = await persistChatAttachments(conversationId, attachments)
      } catch (uploadError) {
        return { ok: false, error: uploadError.message || 'Could not save that photo or file.' }
      }
    } else {
      stored = await Promise.all(attachments.map((item) => toLocalAttachment(item)))
    }

    const localMessage = {
      id: Date.now(),
      from: 'support',
      text: trimmed,
      time: formatTime(),
      attachments: stored,
    }

    setConversations((current) =>
      patchConversation(current, conversationId, (conversation) => ({
        status: conversation.status === 'resolved' ? 'open' : conversation.status,
        unread: 0,
        messages: [...conversation.messages, localMessage],
      })),
    )

    if (supabase && conversationId && conversationId !== LIVE_CHAT_ID) {
      try {
        await sendAdminMessage(conversationId, { text: trimmed, attachments: stored })
        await refreshAdminTickets()
      } catch {
        // Optimistic message stays until the next poll.
      }
    }
    return { ok: true }
  }

  function selectConversation(id) {
    setActiveId(id)
    setAgentTypingState(false)
    setConversations((current) => patchConversation(current, id, () => ({ unread: 0 })))
    if (supabase && id && id !== LIVE_CHAT_ID) {
      markTicketRead(id).catch(() => {})
    }
  }

  async function setStatus(id, status) {
    const conversation = conversations.find((item) => item.id === id)
    const becameResolved = status === 'resolved' && conversation?.status !== 'resolved'
    const notice = becameResolved
      ? {
          id: `resolved-${id}-${Date.now()}`,
          from: 'support',
          text: RESOLVED_NOTICE,
          time: formatTime(),
          event: 'resolved',
        }
      : null

    setConversations((current) =>
      patchConversation(current, id, (item) => ({
        status,
        unread: status === 'resolved' ? 0 : item.unread,
        messages:
          status === 'resolved' && item.status !== 'resolved' && notice && !isResolvedNotice(item.messages.at(-1))
            ? [...item.messages, notice]
            : item.messages,
      })),
    )

    channelRef.current?.postMessage({ type: 'ticket-status', id, status, message: notice })

    if (supabase && id && id !== LIVE_CHAT_ID) {
      try {
        await updateTicketStatus(id, status)
        if (becameResolved) {
          await sendAdminMessage(id, { text: RESOLVED_NOTICE, attachments: [] })
        }
        await refreshAdminTickets()
      } catch {
        // Keep the local status and notice if the ticket update is delayed.
      }
    }
  }

  function setUserTyping(value) {
    setUserTypingState(value)
    channelRef.current?.postMessage({ type: 'typing', role: 'user', value })
  }

  function setAgentTyping(value) {
    setAgentTypingState(value)
    channelRef.current?.postMessage({ type: 'typing', role: 'agent', value })
  }

  const activeConversation = conversations.find((item) => item.id === activeId) || live || null
  const openCount = conversations.filter((item) => item.status !== 'resolved').length
  const waitingCount = conversations.reduce((sum, item) => sum + item.unread, 0)

  const value = useMemo(
    () => ({
      conversations: conversations.map((item) => ({ ...item, preview: previewOf(item) })),
      activeId,
      activeConversation,
      liveMessages: live?.messages || [],
      liveResolved: live?.status === 'resolved',
      typing: botTyping || agentTyping,
      userTyping,
      agentOnline,
      visitor,
      usingSupabase,
      startLiveChat,
      sendUserMessage,
      sendAdminReply,
      selectConversation,
      setStatus,
      setAgentTyping,
      setUserTyping,
      openCount,
      waitingCount,
    }),
    [conversations, activeId, botTyping, agentTyping, userTyping, agentOnline, visitor, usingSupabase],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const context = useContext(ChatContext)
  if (!context) throw new Error('useChat must be used within ChatProvider')
  return context
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
