'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { DriverView } from '@/components/driver/DriverView'
import { Spinner } from '@/components/ui/spinner'
import { Truck } from 'lucide-react'

export default function DriverPage() {
  const router = useRouter()
  const { currentUser, activeRole, isHydrating } = useApp()

  useEffect(() => {
    if (isHydrating) return
    if (!currentUser) {
      router.replace('/login')
      return
    }

    if (activeRole !== 'driver') {
      // Redirect to correct role page
      if (activeRole === 'admin') {
        router.replace('/admin')
      } else if (activeRole === 'business') {
        router.replace('/business')
      } else {
        router.replace('/login')
      }
    }
  }, [currentUser, activeRole, router, isHydrating])

  if (isHydrating || !currentUser || activeRole !== 'driver') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-orange)]/10 flex items-center justify-center">
            <Truck className="w-8 h-8 text-[var(--accent-orange)] animate-pulse" />
          </div>
          <Spinner className="w-6 h-6 text-[var(--accent-orange)]" />
        </div>
      </div>
    )
  }

  return <DriverView />
}
