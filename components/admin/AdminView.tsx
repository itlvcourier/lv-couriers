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
  LogOut,
  Shield
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
      console.error('Sign out error:', err)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-semibold text-foreground">LV Couriers</h1>
                <p className="text-xs text-muted-foreground">Admin Dashboard</p>
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)} className="w-full">
        <div className="sticky top-16 z-40 bg-card/95 backdrop-blur border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <TabsList className="w-full h-12 rounded-none bg-transparent p-0 grid grid-cols-4 max-w-2xl">
              <TabsTrigger 
                value="dashboard" 
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary flex items-center justify-center gap-2 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger 
                value="drivers" 
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary flex items-center justify-center gap-2 transition-colors"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Drivers</span>
              </TabsTrigger>
              <TabsTrigger 
                value="businesses" 
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary flex items-center justify-center gap-2 transition-colors"
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Businesses</span>
              </TabsTrigger>
              <TabsTrigger 
                value="deliveries" 
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary flex items-center justify-center gap-2 transition-colors"
              >
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Deliveries</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
