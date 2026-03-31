'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { PostDeliveryForm } from './PostDeliveryForm'
import { MyDeliveries } from './MyDeliveries'
import { BusinessHeader } from './BusinessHeader'
import { Plus, Package, LogOut } from 'lucide-react'
import { signOut } from '@/lib/auth-actions'
import type { DbBusiness } from '@/lib/types'

interface BusinessViewProps {
  business: DbBusiness
}

export function BusinessView({ business }: BusinessViewProps) {
  const [activeTab, setActiveTab] = useState('deliveries')

  return (
    <div className="min-h-screen bg-background pb-4">
      <BusinessHeader business={business} />
      
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
            <MyDeliveries businessId={business.id} />
          </TabsContent>
          
          <TabsContent value="new" className="mt-0">
            <PostDeliveryForm 
              businessId={business.id} 
              businessAddress={business.address}
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
