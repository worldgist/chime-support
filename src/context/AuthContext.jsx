import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createChatChannel, setAdminOnline } from '../utils/chatStore'

const SESSION_KEY = 'chime-admin-session'

const AuthContext = createContext(null)

function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function displayName(email) {
  const local = email.split('@')[0] || 'Support Admin'
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function toAdmin(user) {
  const email = user.email || ''
  return {
    id: user.id,
    email,
    name: user.user_metadata?.full_name || displayName(email),
  }
}

function broadcastAdmin(online) {
  setAdminOnline(online)
  const channel = createChatChannel()
  channel?.postMessage({ type: 'admin-online', online })
  channel?.close()
}

async function loadAdminProfile(user) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) return null
  return {
    id: data.id,
    email: data.email || user.email,
    name: data.name || toAdmin(user).name,
    role: data.role || 'admin',
  }
}

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!supabase) {
      const session = readSession()
      if (session) {
        broadcastAdmin(true)
        setAdmin(session)
      }
      setReady(true)
      return
    }

    async function applyUser(user) {
      if (!user) {
        setAdmin(null)
        broadcastAdmin(false)
        return
      }
      const profile = await loadAdminProfile(user)
      if (!profile) {
        await supabase.auth.signOut()
        setAdmin(null)
        broadcastAdmin(false)
        return
      }
      setAdmin(profile)
      broadcastAdmin(true)
    }

    supabase.auth.getSession().then(({ data }) => {
      applyUser(data.session?.user).finally(() => setReady(true))
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  async function login(email, password) {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      return { ok: false, error: 'Enter an email and password.' }
    }

    if (!supabase) {
      const session = { email: trimmedEmail, name: displayName(trimmedEmail) }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
      broadcastAdmin(true)
      setAdmin(session)
      return { ok: true }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })
    if (error) return { ok: false, error: error.message }
    if (!data.user) return { ok: false, error: 'Sign in failed.' }

    const profile = await loadAdminProfile(data.user)
    if (!profile) {
      await supabase.auth.signOut()
      return { ok: false, error: 'This account is not an admin.' }
    }

    setAdmin(profile)
    broadcastAdmin(true)
    return { ok: true }
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut()
    sessionStorage.removeItem(SESSION_KEY)
    broadcastAdmin(false)
    setAdmin(null)
  }

  const value = useMemo(
    () => ({
      admin,
      ready,
      isAuthenticated: Boolean(admin),
      usingSupabase: Boolean(supabase),
      login,
      logout,
    }),
    [admin, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
