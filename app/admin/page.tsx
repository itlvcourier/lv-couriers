'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminView } from '@/components/admin/AdminView'
import { Spinner } from '@/components/ui/spinner'

export default function AdminPage() {
  const [isReady, setIsReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      // First check localStorage for session persistence
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null
      
      console.log('[v0] Admin page check:', { hasToken: !!token, hasUserId: !!userId })
      
      if (token && userId) {
        console.log('[v0] Session found in localStorage')
        setIsReady(true)
        return
      }
      
      // Fallback: check Supabase auth
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      console.log('[v0] Supabase auth check:', { hasUser: !!user })
      
      if (!user) {
        console.log('[v0] No auth found, redirecting to login')
        router.push('/auth/login')
        return
      }
      
      setIsReady(true)
    }

    checkAuth()
  }, [router])

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  return <AdminView />
}
