export const CONVERSATIONS_KEY = 'chime-support-conversations'
export const ADMIN_ONLINE_KEY = 'chime-admin-online'
export const CHANNEL_NAME = 'chime-support-sync'

export function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function loadConversations(fallback) {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    const stored = parsed?.conversations
    if (!Array.isArray(stored) || stored.length === 0) return fallback

    const byId = new Map(stored.map((item) => [item.id, item]))
    const merged = fallback.map((item) => byId.get(item.id) || item)
    const extras = stored.filter((item) => !fallback.some((base) => base.id === item.id))
    return [...merged, ...extras]
  } catch {
    return fallback
  }
}

export function saveConversations(conversations) {
  const payload = { updatedAt: Date.now(), conversations }
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(payload))
  } catch {
    // Ignore quota errors so chat still works in memory.
  }
  return payload
}

export function isAdminOnline() {
  return localStorage.getItem(ADMIN_ONLINE_KEY) === '1'
}

export function setAdminOnline(online) {
  if (online) localStorage.setItem(ADMIN_ONLINE_KEY, '1')
  else localStorage.removeItem(ADMIN_ONLINE_KEY)
}

export function createChatChannel() {
  if (typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel(CHANNEL_NAME)
}

export const VISITOR_KEY = 'chime-visitor-profile'

export function loadVisitor() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(VISITOR_KEY) || '')
    if (parsed?.name && parsed?.email && parsed?.phone) return parsed
  } catch {
    // ignore malformed storage
  }
  return null
}

export function saveVisitor(profile) {
  sessionStorage.setItem(VISITOR_KEY, JSON.stringify(profile))
  return profile
}
