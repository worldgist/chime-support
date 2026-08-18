import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function serviceRoleKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
    return keys.default || Object.values(keys)[0] || ''
  } catch {
    return ''
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value))
}

async function findAuthUser(url, serviceKey, email) {
  const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  })
  const data = await res.json()
  if (data?.user && normalizeEmail(data.user.email) === email) return data.user
  const users = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : []
  return users.find((item) => normalizeEmail(item.email) === email) || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = serviceRoleKey()
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const authHeader = req.headers.get('Authorization') || ''

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Supabase service credentials are missing.' }, 500)
  }
  if (!authHeader) {
    return json({ error: 'Sign in as an admin to manage users.' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData?.user) {
    return json({ error: 'Sign in as an admin to manage users.' }, 401)
  }

  const { data: caller } = await admin
    .from('admin_users')
    .select('id, email, name, role')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (!caller) {
    return json({ error: 'This account is not an admin.' }, 403)
  }

  let payload = {}
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Expected JSON with an action.' }, 400)
  }

  const action = String(payload.action || '')
  const name = String(payload.name || '').trim()
  const email = normalizeEmail(payload.email)
  const phone = String(payload.phone || '').trim()
  const role = payload.role === 'admin' || payload.role === 'Admin' ? 'admin' : 'customer'
  const status = ['active', 'review', 'inactive'].includes(payload.status) ? payload.status : 'active'
  const password = String(payload.password || '')
  const userId = payload.id

  async function loadUser(id) {
    const { data, error } = await admin.from('workspace_users').select('*').eq('id', id).maybeSingle()
    if (error || !data) throw new Error('User not found.')
    return data
  }

  async function adminCount() {
    const { count } = await admin
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
    return count || 0
  }

  async function grantLogin(profile) {
    if (password.length < 6) {
      throw new Error('Admin password must be at least 6 characters.')
    }

    let authUser = await findAuthUser(supabaseUrl, serviceKey, profile.email)
    if (!authUser) {
      const created = await admin.auth.admin.createUser({
        email: profile.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: profile.name },
      })
      authUser = created.data?.user || (await findAuthUser(supabaseUrl, serviceKey, profile.email))
      if (!authUser) throw new Error(created.error?.message || 'Could not create the admin login.')
    }

    const updated = await admin.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: profile.name },
    })
    if (updated.error) throw new Error(updated.error.message)
    authUser = updated.data?.user || authUser

    const { error: adminError } = await admin.from('admin_users').upsert({
      id: authUser.id,
      email: profile.email,
      name: profile.name,
      role: profile.admin_role || 'admin',
    })
    if (adminError) throw new Error(adminError.message)

    const { data, error } = await admin
      .from('workspace_users')
      .update({
        role: 'admin',
        source: profile.source === 'manual' ? 'admin' : profile.source,
        admin_user_id: authUser.id,
        name: profile.name,
        phone: profile.phone,
        status: profile.status,
      })
      .eq('id', profile.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  try {
    if (action === 'create') {
      if (!name || !isEmail(email)) throw new Error('Enter a full name and a valid email.')

      const { data: existing } = await admin
        .from('workspace_users')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      if (existing) throw new Error('A user with this email already exists.')

      const { data: created, error } = await admin
        .from('workspace_users')
        .insert({
          name,
          email,
          phone: phone || null,
          role,
          status,
          source: role === 'admin' ? 'admin' : 'manual',
          created_by: caller.id,
        })
        .select('*')
        .single()
      if (error) throw new Error(error.message)

      if (role === 'admin' && password) {
        return json({ ok: true, user: await grantLogin({ ...created, name, phone, status }) })
      }
      return json({ ok: true, user: created })
    }

    if (action === 'update') {
      const current = await loadUser(userId)
      const nextEmail = email || current.email
      const nextName = name || current.name
      if (!nextName || !isEmail(nextEmail)) throw new Error('Enter a full name and a valid email.')

      const { data: updated, error } = await admin
        .from('workspace_users')
        .update({
          name: nextName,
          email: nextEmail,
          phone: phone || null,
          role,
          status,
        })
        .eq('id', current.id)
        .select('*')
        .single()
      if (error) throw new Error(error.message)

      if (role === 'admin' && password) {
        return json({ ok: true, user: await grantLogin({ ...updated, name: nextName, phone, status }) })
      }

      if (role === 'customer' && current.admin_user_id) {
        if (current.admin_user_id === caller.id) {
          throw new Error('You cannot remove your own admin access.')
        }
        if ((await adminCount()) <= 1) {
          throw new Error('Keep at least one admin account.')
        }
        await admin.from('admin_users').delete().eq('id', current.admin_user_id)
        const { data: demoted, error: demoteError } = await admin
          .from('workspace_users')
          .update({ role: 'customer', admin_user_id: null })
          .eq('id', current.id)
          .select('*')
          .single()
        if (demoteError) throw new Error(demoteError.message)
        return json({ ok: true, user: demoted })
      }

      return json({ ok: true, user: updated })
    }

    if (action === 'grantAdmin') {
      const current = await loadUser(userId)
      return json({
        ok: true,
        user: await grantLogin({
          ...current,
          name: name || current.name,
          phone: phone || current.phone,
          status,
        }),
      })
    }

    if (action === 'revokeAdmin' || action === 'delete') {
      const current = await loadUser(userId)
      if (current.admin_user_id === caller.id) {
        throw new Error(action === 'delete' ? 'You cannot delete your own account.' : 'You cannot remove your own admin access.')
      }
      if (current.admin_user_id) {
        if ((await adminCount()) <= 1) {
          throw new Error('Keep at least one admin account.')
        }
        await admin.from('admin_users').delete().eq('id', current.admin_user_id)
      }
      if (action === 'delete') {
        const { error } = await admin.from('workspace_users').delete().eq('id', current.id)
        if (error) throw new Error(error.message)
        return json({ ok: true, deleted: true })
      }
      const { data: revoked, error } = await admin
        .from('workspace_users')
        .update({ role: 'customer', admin_user_id: null, source: current.source === 'admin' ? 'manual' : current.source })
        .eq('id', current.id)
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      return json({ ok: true, user: revoked })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (error) {
    return json({ error: error.message || 'Could not update that user.' }, 400)
  }
})
