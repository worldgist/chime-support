import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import {
  deleteWorkspaceUser,
  fetchWorkspaceUsers,
  insertWorkspaceUser,
  manageWorkspaceUser,
  updateWorkspaceUser,
} from '../utils/workspaceUsers'

const UserContext = createContext(null)
const STORAGE_KEY = 'chime-admin-users'

function joinedLabel() {
  return new Date().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function loadLocalUsers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '')
    if (Array.isArray(parsed)) return parsed
  } catch {
    // ignore
  }
  return []
}

function normalizeProfile({ name, email, phone, status = 'active', role = 'Customer' }) {
  return {
    name: String(name || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    phone: String(phone || '').trim(),
    status,
    role: role === 'Admin' || role === 'admin' ? 'Admin' : 'Customer',
  }
}

export function UserProvider({ children }) {
  const { isAuthenticated, ready } = useAuth()
  const usingSupabase = Boolean(supabase)
  const [users, setUsers] = useState(() => (usingSupabase ? [] : loadLocalUsers()))
  const [loading, setLoading] = useState(usingSupabase)
  const [error, setError] = useState('')

  async function refreshUsers() {
    if (!supabase) return []
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      setUsers([])
      setLoading(false)
      return []
    }
    const next = await fetchWorkspaceUsers()
    setUsers(next)
    setError('')
    setLoading(false)
    return next
  }

  useEffect(() => {
    if (!supabase) return undefined
    if (!ready || !isAuthenticated) {
      if (ready) {
        setUsers([])
        setLoading(false)
      }
      return undefined
    }
    let cancelled = false

    async function load() {
      try {
        if (!cancelled) await refreshUsers()
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || 'Could not load users.')
          setLoading(false)
        }
      }
    }

    load()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) load()
      else {
        setUsers([])
        setLoading(false)
      }
    })
    const realtime = supabase
      .channel('workspace-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_users' }, load)
      .subscribe()
    const poll = window.setInterval(load, 8000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      supabase.removeChannel(realtime)
      data.subscription.unsubscribe()
    }
  }, [ready, isAuthenticated])

  useEffect(() => {
    if (usingSupabase) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
  }, [users, usingSupabase])

  async function createUser(input) {
    const profile = normalizeProfile(input)
    if (!profile.name || !profile.email) return { ok: false, error: 'Enter a full name and email.' }
    if (users.some((item) => item.email === profile.email)) {
      return { ok: false, error: 'A user with this email already exists.' }
    }

    if (supabase) {
      try {
        const needsLogin = profile.role === 'Admin' && input.password
        const result = needsLogin
          ? await manageWorkspaceUser({
              action: 'create',
              ...profile,
              password: input.password,
            })
          : { user: await insertWorkspaceUser({ ...profile, createdBy: input.createdBy }) }
        await refreshUsers()
        return { ok: true, user: result.user }
      } catch (createError) {
        return { ok: false, error: createError.message || 'Could not create that user.' }
      }
    }

    const user = {
      id: `u-${Date.now()}`,
      ...profile,
      phone: profile.phone || '—',
      source: 'manual',
      canLogin: false,
      joined: joinedLabel(),
    }
    setUsers((current) => [user, ...current])
    return { ok: true, user }
  }

  async function updateUser(id, input) {
    const current = users.find((item) => item.id === id)
    if (!current) return { ok: false, error: 'User not found.' }
    const profile = normalizeProfile({ ...current, ...input })
    if (!profile.name || !profile.email) return { ok: false, error: 'Enter a full name and email.' }
    if (users.some((item) => item.email === profile.email && item.id !== id)) {
      return { ok: false, error: 'A user with this email already exists.' }
    }

    if (supabase) {
      try {
        const needsManage =
          Boolean(input.password) ||
          current.canLogin ||
          (current.role === 'Admin' && profile.role === 'Customer')
        if (needsManage) {
          await manageWorkspaceUser({
            action: 'update',
            id,
            ...profile,
            password: input.password,
          })
        } else {
          await updateWorkspaceUser(id, profile)
        }
        await refreshUsers()
        return { ok: true }
      } catch (updateError) {
        return { ok: false, error: updateError.message || 'Could not update that user.' }
      }
    }

    setUsers((list) => list.map((item) => (item.id === id ? { ...item, ...profile, phone: profile.phone || '—' } : item)))
    return { ok: true }
  }

  async function setUserStatus(id, status) {
    if (supabase) {
      try {
        await updateWorkspaceUser(id, { status })
        await refreshUsers()
      } catch {
        // keep current list
      }
      return
    }
    setUsers((current) => current.map((item) => (item.id === id ? { ...item, status } : item)))
  }

  async function grantAdminAccess(id, password) {
    if (!password || password.length < 6) {
      return { ok: false, error: 'Admin password must be at least 6 characters.' }
    }
    if (!supabase) return { ok: false, error: 'Connect Supabase to grant dashboard access.' }
    try {
      await manageWorkspaceUser({ action: 'grantAdmin', id, password })
      await refreshUsers()
      return { ok: true }
    } catch (grantError) {
      return { ok: false, error: grantError.message || 'Could not grant admin access.' }
    }
  }

  async function revokeAdminAccess(id) {
    if (!supabase) return { ok: false, error: 'Connect Supabase to revoke dashboard access.' }
    try {
      await manageWorkspaceUser({ action: 'revokeAdmin', id })
      await refreshUsers()
      return { ok: true }
    } catch (revokeError) {
      return { ok: false, error: revokeError.message || 'Could not revoke admin access.' }
    }
  }

  async function deleteUser(id) {
    const current = users.find((item) => item.id === id)
    if (!current) return { ok: false, error: 'User not found.' }

    if (supabase) {
      try {
        if (current.canLogin) {
          await manageWorkspaceUser({ action: 'delete', id })
        } else {
          await deleteWorkspaceUser(id)
        }
        await refreshUsers()
        return { ok: true }
      } catch (deleteError) {
        return { ok: false, error: deleteError.message || 'Could not delete that user.' }
      }
    }

    setUsers((list) => list.filter((item) => item.id !== id))
    return { ok: true }
  }

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((item) => item.status === 'active').length,
      review: users.filter((item) => item.status === 'review').length,
      inactive: users.filter((item) => item.status === 'inactive').length,
      admins: users.filter((item) => item.role === 'Admin').length,
    }),
    [users],
  )

  const value = useMemo(
    () => ({
      users,
      loading,
      error,
      usingSupabase,
      createUser,
      updateUser,
      setUserStatus,
      grantAdminAccess,
      revokeAdminAccess,
      deleteUser,
      refreshUsers,
      counts,
      count: users.length,
    }),
    [users, loading, error, usingSupabase, counts],
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUsers() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUsers must be used within UserProvider')
  return context
}
