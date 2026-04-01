'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BusinessView } from '@/components/business/BusinessView'
import { Spinner } from '@/components/ui/spinner'

export default function BusinessPage() {
  const [isReady, setIsReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    console.log('[v0] Business page useEffect running')
    const checkAuth = async () => {
      // First check localStorage for session persistence
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null
      
      console.log('[v0] Business page check:', { hasToken: !!token, hasUserId: !!userId, tokenValue: token?.substring(0, 20) })
      
      if (token && userId) {
        console.log('[v0] Session found in localStorage, setting ready')
        setIsReady(true)
        return
      }
      
      console.log('[v0] No localStorage token, checking Supabase')
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

  return <BusinessView />
}
