'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { AvailableJobs } from './AvailableJobs'
import { ActiveDeliveries } from './ActiveDeliveries'
import { DriverHistory } from './DriverHistory'
import { DriverHeader } from './DriverHeader'
import { Package, Truck, Clock, LogOut } from 'lucide-react'
import { signOut } from '@/lib/auth-actions'
import type { DbDriver } from '@/lib/types'

interface DriverViewProps {
  driver: DbDriver
}

export function DriverView({ driver }: DriverViewProps) {
  const [activeTab, setActiveTab] = useState('available')

  return (
    <div className="min-h-screen bg-background pb-4">
      <DriverHeader driver={driver} />
      
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
            <AvailableJobs driverId={driver.id} onJobClaimed={() => setActiveTab('active')} />
          </TabsContent>
          
          <TabsContent value="active" className="mt-0">
            <ActiveDeliveries driverId={driver.id} />
          </TabsContent>
          
          <TabsContent value="history" className="mt-0">
            <DriverHistory driverId={driver.id} />
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
