'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { AvailableJobs } from './AvailableJobs'
import { ActiveDeliveries } from './ActiveDeliveries'
import { DriverHistory } from './DriverHistory'
import { DriverHeader } from './DriverHeader'
import { Package, Truck, Clock, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/spinner'

export function DriverView() {
  const [activeTab, setActiveTab] = useState('available')
  const [driverId, setDriverId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getDriver = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setDriverId(user.id)
        }
      } catch (err) {
        console.error('[v0] Error getting driver:', err)
      } finally {
        setLoading(false)
      }
    }
    getDriver()
  }, [])

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_id')
      localStorage.removeItem('user_role')
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/auth/login')
    } catch (err) {
      console.error('[v0] Sign out error:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
          <TabsList className="w-full h-14 rounded-none bg-transparent p-0 grid grid-cols-3">
            <TabsTrigger 
              value="available" 
              className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center justify-center gap-2"
            >
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Available</span>
            </TabsTrigger>
            <TabsTrigger 
              value="active" 
              className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center justify-center gap-2"
            >
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">Active</span>
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="p-4 max-w-2xl mx-auto">
          <TabsContent value="available" className="mt-0">
            <AvailableJobs driverId={driverId} onJobClaimed={() => setActiveTab('active')} />
          </TabsContent>
          
          <TabsContent value="active" className="mt-0">
            <ActiveDeliveries driverId={driverId} />
          </TabsContent>
          
          <TabsContent value="history" className="mt-0">
            <DriverHistory driverId={driverId} />
          </TabsContent>
        </div>
      </Tabs>

      <div className="fixed bottom-4 right-4">
        <Button onClick={handleSignOut} variant="outline" size="sm" className="gap-2">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
