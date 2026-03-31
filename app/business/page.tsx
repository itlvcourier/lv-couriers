'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getBusinessByUserId } from '@/lib/db'
import { BusinessView } from '@/components/business/BusinessView'
import { Spinner } from '@/components/ui/spinner'
import type { DbBusiness } from '@/lib/types'

export default function BusinessPage() {
  const [business, setBusiness] = useState<DbBusiness | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadBusiness() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const businessData = await getBusinessByUserId(user.id)
        setBusiness(businessData)
      }
      setLoading(false)
    }
    loadBusiness()
  }, [supabase.auth])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Business Profile Not Found</h1>
          <p className="text-muted-foreground">Your account is not linked to a business profile. Please contact support.</p>
        </div>
      </div>
    )
  }

  return <BusinessView business={business} />
}
