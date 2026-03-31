import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function BusinessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const role = user.user_metadata?.role
  if (role && role !== 'business') {
    redirect(role === 'admin' ? '/admin' : '/driver')
  }

  return <>{children}</>
}
