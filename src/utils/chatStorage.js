import { supabase } from '../lib/supabase'
import { MAX_FILE_SIZE } from './attachments'

export const CHAT_BUCKET = 'chat-attachments'

function safeFileName(name) {
  const base = String(name || 'file')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
  return base || 'file'
}

function isTicketId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''))
}

export function publicChatFileUrl(path) {
  if (!supabase || !path) return ''
  const { data } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(path)
  return data?.publicUrl || ''
}

export function toStoredAttachment(item) {
  const path = item.path || ''
  return {
    id: item.id,
    type: item.type === 'image' ? 'image' : 'file',
    name: item.name,
    size: item.size,
    mime: item.mime,
    path,
    url: item.url && !item.url.startsWith('blob:') ? item.url : publicChatFileUrl(path),
  }
}

export async function uploadChatAttachment(ticketId, item) {
  if (!item) return null
  if (item.path && item.url && !item.url.startsWith('blob:')) {
    return toStoredAttachment(item)
  }
  if (!supabase || !isTicketId(ticketId)) {
    throw new Error('Chat storage is not ready for this ticket.')
  }

  const file = item.file
  if (!file) {
    return toStoredAttachment(item)
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${item.name} is larger than 10 MB.`)
  }

  const path = `${ticketId}/${item.id}/${safeFileName(item.name)}`
  const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: item.mime || file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(error.message || `Could not save ${item.name}.`)

  return toStoredAttachment({
    ...item,
    path,
    url: publicChatFileUrl(path),
  })
}

export async function persistChatAttachments(ticketId, attachments = []) {
  if (!attachments.length) return []
  const saved = []
  for (const item of attachments) {
    saved.push(await uploadChatAttachment(ticketId, item))
  }
  return saved
}
