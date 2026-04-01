'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { PostDeliveryForm } from './DeliveryForm'
import { MyDeliveries } from './MyDeliveries'
import { Plus, Package, LogOut, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/spinner'

export function BusinessView() {
  const [activeTab, setActiveTab] = useState('deliveries')
  const [businessId, setBusinessId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getBusiness = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setBusinessId(user.id)
        }
      } catch (err) {
        console.error('Error getting business:', err)
      } finally {
        setLoading(false)
      }
    }
    getBusiness()
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
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Truck className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <Spinner className="w-6 h-6 text-primary" />
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
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Truck className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-semibold text-foreground">LV Couriers</h1>
                <p className="text-xs text-muted-foreground">Business Portal</p>
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
            <TabsList className="w-full h-12 rounded-none bg-transparent p-0 grid grid-cols-2 max-w-md mx-auto">
              <TabsTrigger 
                value="deliveries" 
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary flex items-center justify-center gap-2 transition-colors"
              >
                <Package className="w-4 h-4" />
                <span className="font-medium">My Deliveries</span>
              </TabsTrigger>
              <TabsTrigger 
                value="new" 
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="font-medium">Post New</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <TabsContent value="deliveries" className="mt-0">
            <MyDeliveries businessId={businessId} />
          </TabsContent>
          
          <TabsContent value="new" className="mt-0">
            <div className="max-w-xl mx-auto">
              <PostDeliveryForm 
                businessId={businessId} 
                businessAddress=""
                onSuccess={() => setActiveTab('deliveries')}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
