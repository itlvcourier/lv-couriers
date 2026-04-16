'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CreateOrderForm } from './CreateOrderForm'
import { BusinessOrders } from './BusinessOrders'
import { BusinessInvoices } from './BusinessInvoices'
import { BusinessProfile } from './BusinessProfile'
import { 
  Plus, 
  Package, 
  Building2,
  User,
  FileText
} from 'lucide-react'

export function BusinessView() {
  const [activeTab, setActiveTab] = useState('orders')
  const { currentUser, businesses } = useApp()
  
  const business = businesses.find(b => b.id === currentUser?.businessId)

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <Building2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">DOMS</h1>
                <p className="text-xs text-muted-foreground">Business Portal</p>
              </div>
            </div>
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {business?.name ? getInitials(business.name) : 'B'}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <TabsContent value="orders" className="mt-0 m-0">
              <BusinessOrders />
            </TabsContent>
            
            <TabsContent value="create" className="mt-0 m-0">
              <CreateOrderForm onSuccess={() => setActiveTab('orders')} />
            </TabsContent>

            <TabsContent value="invoices" className="mt-0 m-0">
              <BusinessInvoices />
            </TabsContent>
            
            <TabsContent value="profile" className="mt-0 m-0">
              <BusinessProfile />
            </TabsContent>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="sticky bottom-0 bg-card border-t border-border safe-area-bottom">
          <TabsList className="w-full h-16 rounded-none bg-transparent p-0 grid grid-cols-4 max-w-lg mx-auto">
            <TabsTrigger 
              value="orders" 
              className="h-full rounded-none flex flex-col items-center justify-center gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary text-muted-foreground"
            >
              <Package className="w-5 h-5" />
              <span className="text-xs font-medium">Orders</span>
            </TabsTrigger>
            <TabsTrigger 
              value="create" 
              className="h-full rounded-none flex flex-col items-center justify-center gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary text-muted-foreground"
            >
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center -mt-4 shadow-lg">
                <Plus className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xs font-medium -mt-1">Create</span>
            </TabsTrigger>
            <TabsTrigger 
              value="invoices" 
              className="h-full rounded-none flex flex-col items-center justify-center gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary text-muted-foreground"
            >
              <FileText className="w-5 h-5" />
              <span className="text-xs font-medium">Invoices</span>
            </TabsTrigger>
            <TabsTrigger 
              value="profile" 
              className="h-full rounded-none flex flex-col items-center justify-center gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary text-muted-foreground"
            >
              <User className="w-5 h-5" />
              <span className="text-xs font-medium">Profile</span>
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>
    </div>
  )
}
