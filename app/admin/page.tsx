'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { AdminView } from '@/components/admin/AdminView'
import { Spinner } from '@/components/ui/spinner'
import { Shield } from 'lucide-react'

export default function AdminPage() {
  const { currentUser } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!currentUser) {
      router.replace('/login')
      return
    }
    if (currentUser.role !== 'admin') {
      router.replace(`/${currentUser.role}`)
    }
  }, [currentUser, router])

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <Spinner className="w-6 h-6" />
        </div>
      </div>
    )
  }

  return <AdminView />
}
