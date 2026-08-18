import { supabase } from '../lib/supabase'
import { formatTime } from './chatStore'
import { publicChatFileUrl } from './chatStorage'

function serializeAttachments(attachments = [], { allowDataUrl = false } = {}) {
  return attachments.map((item) => {
    const rawUrl = String(item.url || '')
    const keepUrl =
      rawUrl.startsWith('http') || (allowDataUrl && rawUrl.startsWith('data:'))
    return {
      id: item.id,
      type: item.type === 'image' ? 'image' : 'file',
      name: item.name,
      size: item.size,
      mime: item.mime,
      path: item.path || '',
      url: keepUrl ? rawUrl : publicChatFileUrl(item.path),
    }
  })
}

export function mapMessage(row) {
  return {
    id: row.id,
    from: row.sender === 'support' ? 'support' : 'user',
    text: row.body || '',
    time: formatTime(new Date(row.created_at)),
    attachments: serializeAttachments(Array.isArray(row.attachments) ? row.attachments : [], {
      allowDataUrl: true,
    }),
  }
}

export function mapTicket(ticket, messages = []) {
  return {
    id: ticket.id,
    accessToken: ticket.access_token,
    customer: {
      name: ticket.customer_name,
      email: ticket.customer_email,
      phone: ticket.customer_phone || '',
      topic: ticket.topic || 'Account issue',
      memberSince: ticket.created_at ? String(new Date(ticket.created_at).getFullYear()) : '',
    },
    status: ticket.status || 'open',
    unread: ticket.unread || 0,
    messages: messages.map(mapMessage),
  }
}

export async function createSupportTicket({ name, email, phone, topic }) {
  const { data, error } = await supabase.rpc('create_support_ticket', {
    p_name: name,
    p_email: email,
    p_phone: phone,
    p_topic: topic || 'Account issue',
  })
  if (error) throw error
  return data
}

export async function fetchCustomerThread(ticketId, token) {
  const { data, error } = await supabase.rpc('get_support_thread', {
    p_id: ticketId,
    p_token: token,
  })
  if (error) throw error
  if (!data?.ticket) throw new Error('Ticket not found')
  const messages = Array.isArray(data.messages) ? data.messages : []
  return mapTicket(data.ticket, messages)
}

export async function sendCustomerMessage(ticketId, token, { text, attachments }) {
  const { data, error } = await supabase.rpc('add_customer_message', {
    p_id: ticketId,
    p_token: token,
    p_body: text || '',
    p_attachments: serializeAttachments(attachments || []),
  })
  if (error) throw error
  return mapMessage(data)
}

export async function fetchAdminTickets() {
  const { data: tickets, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('last_activity_at', { ascending: false })
  if (error) throw error

  const ids = (tickets || []).map((item) => item.id)
  if (ids.length === 0) return []

  const { data: messages, error: messageError } = await supabase
    .from('support_ticket_messages')
    .select('*')
    .in('ticket_id', ids)
    .order('created_at', { ascending: true })
  if (messageError) throw messageError

  const byTicket = new Map()
  for (const message of messages || []) {
    const list = byTicket.get(message.ticket_id) || []
    list.push(message)
    byTicket.set(message.ticket_id, list)
  }

  return tickets.map((ticket) => mapTicket(ticket, byTicket.get(ticket.id) || []))
}

export async function sendAdminMessage(ticketId, { text, attachments }) {
  const { data, error } = await supabase
    .from('support_ticket_messages')
    .insert({
      ticket_id: ticketId,
      sender: 'support',
      body: text || '',
      attachments: serializeAttachments(attachments || []),
    })
    .select('*')
    .single()
  if (error) throw error
  return mapMessage(data)
}

export async function updateTicketStatus(ticketId, status) {
  const patch = { status, updated_at: new Date().toISOString() }
  if (status === 'resolved') patch.unread = 0
  const { error } = await supabase.from('support_tickets').update(patch).eq('id', ticketId)
  if (error) throw error
}

export async function markTicketRead(ticketId) {
  const { error } = await supabase.from('support_tickets').update({ unread: 0 }).eq('id', ticketId)
  if (error) throw error
}
