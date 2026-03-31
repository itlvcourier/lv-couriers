import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const demoAccounts = [
  {
    email: 'business@demo.lvcouriers.com',
    password: 'Demo@123',
    metadata: { role: 'business', name: 'Downtown Deli' },
  },
  {
    email: 'driver@demo.lvcouriers.com',
    password: 'Demo@123',
    metadata: { role: 'driver', name: 'Marcus Johnson' },
  },
  {
    email: 'admin@demo.lvcouriers.com',
    password: 'Demo@123',
    metadata: { role: 'admin', name: 'Admin User' },
  },
]

async function createDemoAccounts() {
  console.log('[v0] Creating demo accounts...')

  for (const account of demoAccounts) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: account.metadata,
      })

      if (error) {
        console.error(`[v0] Error creating ${account.email}:`, error.message)
      } else {
        console.log(`[v0] Created user: ${account.email} with ID: ${data.user.id}`)
      }
    } catch (err) {
      console.error(`[v0] Exception creating ${account.email}:`, err)
    }
  }

  console.log('[v0] Demo account creation complete!')
}

createDemoAccounts()
