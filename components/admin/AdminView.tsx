'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { AdminDashboard } from './AdminDashboard'
import { AdminDrivers } from './AdminDrivers'
import { AdminBusinesses } from './AdminBusinesses'
import { AdminDeliveries } from './AdminDeliveries'
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Package, 
  Truck,
  LogOut 
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type AdminTab = 'dashboard' | 'drivers' | 'businesses' | 'deliveries'

export function AdminView() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')
  const router = useRouter()

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/50 border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">LV Couriers</h1>
              <p className="text-sm text-muted-foreground">Admin Dashboard</p>
            </div>
          </div>
          <Button onClick={handleSignOut} variant="outline" size="sm" className="gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </header>
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)} className="w-full">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
          <div className="max-w-7xl mx-auto">
            <TabsList className="w-full h-14 rounded-none bg-transparent p-0 grid grid-cols-4">
              <TabsTrigger 
                value="dashboard" 
                className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center justify-center gap-2"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger 
                value="drivers" 
                className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Drivers</span>
              </TabsTrigger>
              <TabsTrigger 
                value="businesses" 
                className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center justify-center gap-2"
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Businesses</span>
              </TabsTrigger>
              <TabsTrigger 
                value="deliveries" 
                className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center justify-center gap-2"
              >
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">Deliveries</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="p-4 max-w-7xl mx-auto">
          <TabsContent value="dashboard" className="mt-0">
            <AdminDashboard />
          </TabsContent>
          
          <TabsContent value="drivers" className="mt-0">
            <AdminDrivers />
          </TabsContent>
          
          <TabsContent value="businesses" className="mt-0">
            <AdminBusinesses />
          </TabsContent>
          
          <TabsContent value="deliveries" className="mt-0">
            <AdminDeliveries />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
