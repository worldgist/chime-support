import { supabase } from '../lib/supabase'

export function formatJoined(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export function mapWorkspaceUser(row) {
  const role = row.role === 'admin' || row.role === 'Admin' ? 'Admin' : 'Customer'
  return {
    id: row.id,
    name: row.name || '',
    email: String(row.email || '').toLowerCase(),
    phone: row.phone || '—',
    status: row.status || 'active',
    role,
    source: row.source || 'manual',
    notes: row.notes || '',
    adminUserId: row.admin_user_id || row.adminUserId || null,
    canLogin: Boolean(row.admin_user_id || row.adminUserId),
    joined: formatJoined(row.created_at || row.joined),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  }
}

function toRole(role) {
  return role === 'Admin' || role === 'admin' ? 'admin' : 'customer'
}

async function invokeManageUser(body) {
  const { data, error } = await supabase.functions.invoke('manage-workspace-user', { body })
  if (!error && data?.ok) return data
  let message = data?.error || error?.message || 'Could not update that user.'
  if (error?.context) {
    try {
      const payload = await error.context.json()
      message = payload?.error || message
    } catch {
      // keep message
    }
  }
  throw new Error(message)
}

export async function fetchWorkspaceUsers() {
  const { data, error } = await supabase
    .from('workspace_users')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapWorkspaceUser)
}

export async function insertWorkspaceUser(profile) {
  const { data, error } = await supabase
    .from('workspace_users')
    .insert({
      name: profile.name,
      email: profile.email,
      phone: profile.phone || null,
      role: toRole(profile.role),
      status: profile.status || 'active',
      source: toRole(profile.role) === 'admin' ? 'admin' : 'manual',
      created_by: profile.createdBy || null,
    })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('A user with this email already exists.')
    throw error
  }
  return mapWorkspaceUser(data)
}

export async function updateWorkspaceUser(id, patch) {
  const { data, error } = await supabase
    .from('workspace_users')
    .update({
      ...(patch.name != null ? { name: patch.name } : {}),
      ...(patch.email != null ? { email: patch.email } : {}),
      ...(patch.phone != null ? { phone: patch.phone || null } : {}),
      ...(patch.role != null ? { role: toRole(patch.role) } : {}),
      ...(patch.status != null ? { status: patch.status } : {}),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('A user with this email already exists.')
    throw error
  }
  return mapWorkspaceUser(data)
}

export async function deleteWorkspaceUser(id) {
  const { error } = await supabase.from('workspace_users').delete().eq('id', id)
  if (error) throw error
}

export async function manageWorkspaceUser(payload) {
  const result = await invokeManageUser(payload)
  return {
    ok: true,
    deleted: Boolean(result.deleted),
    user: result.user ? mapWorkspaceUser(result.user) : null,
  }
}
