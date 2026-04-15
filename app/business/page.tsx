'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { BusinessView } from '@/components/business/BusinessView'
import { Spinner } from '@/components/ui/spinner'
import { Truck } from 'lucide-react'

export default function BusinessPage() {
  const { currentUser, isLoading } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.replace('/login')
    }
    if (!isLoading && currentUser && currentUser.role !== 'business') {
      router.replace(`/${currentUser.role}`)
    }
  }, [currentUser, isLoading, router])

  if (isLoading || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Truck className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <Spinner className="w-6 h-6" />
        </div>
      </div>
    )
  }

  return <BusinessView />
}
