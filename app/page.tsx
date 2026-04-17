'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { Spinner } from '@/components/ui/spinner'
import { Truck } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const { currentUser, activeRole, isHydrating } = useApp()

  useEffect(() => {
    // Wait for Supabase session check before deciding where to route.
    if (isHydrating) return
    if (!currentUser) {
      router.replace('/login')
      return
    }

    // Route based on role
    switch (activeRole) {
      case 'admin':
        router.replace('/admin')
        break
      case 'driver':
        router.replace('/driver')
        break
      case 'business':
        router.replace('/business')
        break
      default:
        router.replace('/login')
    }
  }, [currentUser, activeRole, router, isHydrating])

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent-orange)]/10 flex items-center justify-center">
          <Truck className="w-8 h-8 text-[var(--accent-orange)] animate-pulse" />
        </div>
        <Spinner className="w-6 h-6 text-[var(--accent-orange)]" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
