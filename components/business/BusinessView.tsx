'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { PostDeliveryForm } from './PostDeliveryForm'
import { MyDeliveries } from './MyDeliveries'
import { Plus, Package, LogOut } from 'lucide-react'
import { signOut } from '@/lib/auth-actions'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/spinner'

export function BusinessView() {
  const [activeTab, setActiveTab] = useState('deliveries')
  const [businessId, setBusinessId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getBusiness = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setBusinessId(user.id)
        }
      } catch (err) {
        console.error('[v0] Error getting business:', err)
      } finally {
        setLoading(false)
      }
    }
    getBusiness()
  }, [])

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
          <TabsList className="w-full h-14 rounded-none bg-transparent p-0 grid grid-cols-2">
            <TabsTrigger 
              value="deliveries" 
              className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center justify-center gap-2"
            >
              <Package className="w-4 h-4" />
              My Deliveries
            </TabsTrigger>
            <TabsTrigger 
              value="new" 
              className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Post New
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="p-4 max-w-2xl mx-auto">
          <TabsContent value="deliveries" className="mt-0">
            <MyDeliveries businessId={businessId} />
          </TabsContent>
          
          <TabsContent value="new" className="mt-0">
            <PostDeliveryForm 
              businessId={businessId} 
              businessAddress=""
              onSuccess={() => setActiveTab('deliveries')}
            />
          </TabsContent>
        </div>
      </Tabs>

      <div className="fixed bottom-4 right-4">
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm" className="gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  )
}
