'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/lib/context'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AdminDashboard } from './AdminDashboard'
import { AdminDrivers } from './AdminDrivers'
import { AdminBusinesses } from './AdminBusinesses'
import { AdminOrders } from './AdminOrders'
import { AdminRateCards } from './AdminRateCards'
import { AdminInvoices } from './AdminInvoices'
import { AdminSettings } from './AdminSettings'
import { AdminCommunications } from './AdminCommunications'
import { AdminDriverReports } from './AdminDriverReports'
import { AdminAuditLog } from './AdminAuditLog'
import { DispatchBoard } from './DispatchBoard'
import { ApprovalQueue } from './ApprovalQueue'
import { getPendingCount } from '@/lib/dispatch-requests'
import { NotificationCenter } from './NotificationCenter'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Package,
  CreditCard,
  FileText,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  Bell,
  MessageSquare,
  BarChart3,
  Radio,
  ScrollText,
  Inbox,
} from 'lucide-react'

type AdminPage = 'dashboard' | 'dispatch' | 'requests' | 'drivers' | 'businesses' | 'orders' | 'rate_cards' | 'invoices' | 'communications' | 'reports' | 'audit' | 'settings'

const navItems: { id: AdminPage; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'dispatch', label: 'Dispatch', icon: Radio },
  { id: 'requests', label: 'Requests', icon: Inbox },
  { id: 'drivers', label: 'Drivers', icon: Users },
  { id: 'businesses', label: 'Businesses', icon: Building2 },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'rate_cards', label: 'Rate Cards', icon: CreditCard },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'communications', label: 'Communications', icon: MessageSquare },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function AdminView() {
  const [activePage, setActivePage] = useState<AdminPage>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingRequests, setPendingRequests] = useState(0)
  const { logout, currentUser } = useApp()

  useEffect(() => {
    let active = true
    const poll = () => {
      getPendingCount()
        .then((n) => {
          if (active) setPendingRequests(n)
        })
        .catch(() => {})
    }
    poll()
    const id = setInterval(poll, 30_000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [activePage])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AdminPage>).detail
      if (detail) setActivePage(detail)
    }
    window.addEventListener('doms:navigate-admin', handler)
    return () => window.removeEventListener('doms:navigate-admin', handler)
  }, [])

  // For admin, just use currentUser info directly
  const admin = currentUser ? { name: currentUser.name, email: currentUser.email, avatar: undefined } : null

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <AdminDashboard />
      case 'dispatch': return <DispatchBoard />
      case 'requests': return <ApprovalQueue />
      case 'drivers': return <AdminDrivers />
      case 'businesses': return <AdminBusinesses />
      case 'orders': return <AdminOrders />
      case 'rate_cards': return <AdminRateCards />
      case 'invoices': return <AdminInvoices />
      case 'communications': return <AdminCommunications />
      case 'reports': return <AdminDriverReports />
      case 'audit': return <AdminAuditLog />
      case 'settings': return <AdminSettings />
      default: return <AdminDashboard />
    }
  }

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 lg:translate-x-0 shrink-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Sidebar Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">DOMS</h1>
              <p className="text-xs text-muted-foreground">Admin Panel</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activePage === item.id ? 'secondary' : 'ghost'}
              className={cn(
                "w-full justify-start gap-3 h-11",
                activePage === item.id && "bg-primary/10 text-primary hover:bg-primary/15"
              )}
              onClick={() => {
                setActivePage(item.id)
                setSidebarOpen(false)
              }}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {item.id === 'requests' && pendingRequests > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
                  {pendingRequests}
                </span>
              )}
            </Button>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="w-10 h-10">
              <AvatarImage src={admin?.avatar} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {admin?.name ? getInitials(admin.name) : 'A'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{admin?.name || 'Admin'}</p>
              <p className="text-xs text-muted-foreground truncate">{admin?.email}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => { void logout() }}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-card/95 backdrop-blur border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold capitalize truncate">{activePage.replace('_', ' ')}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationCenter />
            <Avatar className="w-9 h-9 lg:hidden">
              <AvatarImage src={admin?.avatar} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {admin?.name ? getInitials(admin.name) : 'A'}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto overflow-x-hidden">
          <div className="max-w-full">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  )
}
