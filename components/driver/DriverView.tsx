'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { AvailableJobs } from './AvailableJobs'
import { ActiveDeliveries } from './ActiveDeliveries'
import { DriverHistory } from './DriverHistory'
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
        console.error('Error getting driver:', err)
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
      console.error('Sign out error:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center">
            <Truck className="w-8 h-8 text-accent animate-pulse" />
          </div>
          <Spinner className="w-6 h-6 text-accent" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                <Truck className="w-5 h-5 text-accent-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-semibold text-foreground">LV Couriers</h1>
                <p className="text-xs text-muted-foreground">Driver Portal</p>
              </div>
            </div>
            <Button onClick={handleSignOut} variant="outline" size="sm" className="gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-16 z-40 bg-card/95 backdrop-blur border-b border-border">
          <div className="max-w-7xl mx-auto">
            <TabsList className="w-full h-12 rounded-none bg-transparent p-0 grid grid-cols-3 max-w-lg mx-auto">
              <TabsTrigger 
                value="available" 
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-accent flex items-center justify-center gap-2 transition-colors"
              >
                <Package className="w-4 h-4" />
                <span className="font-medium hidden sm:inline">Available</span>
                <span className="font-medium sm:hidden">Jobs</span>
              </TabsTrigger>
              <TabsTrigger 
                value="active" 
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-accent flex items-center justify-center gap-2 transition-colors"
              >
                <Truck className="w-4 h-4" />
                <span className="font-medium">Active</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-accent flex items-center justify-center gap-2 transition-colors"
              >
                <Clock className="w-4 h-4" />
                <span className="font-medium">History</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
    </div>
  )
}
