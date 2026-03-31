'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDriverByUserId } from '@/lib/db'
import { DriverView } from '@/components/driver/DriverView'
import { Spinner } from '@/components/ui/spinner'
import type { DbDriver } from '@/lib/types'

export default function DriverPage() {
  const [driver, setDriver] = useState<DbDriver | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadDriver() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const driverData = await getDriverByUserId(user.id)
        setDriver(driverData)
      }
      setLoading(false)
    }
    loadDriver()
  }, [supabase.auth])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Driver Profile Not Found</h1>
          <p className="text-muted-foreground">Your account is not linked to a driver profile. Please contact an administrator.</p>
        </div>
      </div>
    )
  }

  return <DriverView driver={driver} />
}
