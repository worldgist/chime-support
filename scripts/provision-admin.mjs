import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
const name = process.env.ADMIN_NAME || 'Admin'

if (!url || !serviceKey || !email || !password) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, or ADMIN_PASSWORD')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: name, role: 'super_admin' },
})

let user = created?.user
if (createError) {
  const duplicate = /already been registered|already exists/i.test(createError.message)
  if (!duplicate) {
    console.error(createError.message)
    process.exit(1)
  }

  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listError) {
    console.error(listError.message)
    process.exit(1)
  }
  user = list.users.find((item) => item.email?.toLowerCase() === email.toLowerCase())
  if (!user) {
    console.error('User already exists but could not be loaded.')
    process.exit(1)
  }
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: { full_name: name, role: 'super_admin' },
  })
  if (updateError) {
    console.error(updateError.message)
    process.exit(1)
  }
}

const { error: upsertError } = await supabase.from('admin_users').upsert({
  id: user.id,
  email: email.toLowerCase(),
  name,
  role: 'super_admin',
})

if (upsertError) {
  console.error(upsertError.message)
  process.exit(1)
}

console.log(`Admin ready: ${email}`)
