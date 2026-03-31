'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/spinner'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/auth/login')
        return
      }

      const role = user.user_metadata?.role || 'driver'
      
      if (role === 'driver') {
        router.replace('/driver')
      } else if (role === 'business') {
        router.replace('/business')
      } else if (role === 'admin') {
        router.replace('/admin')
      } else {
        router.replace('/auth/login')
      }
    }

    checkAuth()
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner />
        <p className="text-foreground/60">Redirecting...</p>
      </div>
    </div>
  )
}
