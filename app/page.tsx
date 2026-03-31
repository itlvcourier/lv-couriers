'use client'

import { useApp } from '@/lib/context'
import { RoleSwitcher } from '@/components/shared/RoleSwitcher'
import { DriverView } from '@/components/driver/DriverView'
import { BusinessView } from '@/components/business/BusinessView'
import { AdminView } from '@/components/admin/AdminView'

export default function Home() {
  const { activeRole } = useApp()

  return (
    <div className="min-h-screen bg-[#0d0f14]">
      {/* Role Switcher - floating in top right */}
      <RoleSwitcher />

      {/* Render the active role view with fade animation */}
      <div key={activeRole} className="animate-fade-in">
        {activeRole === 'driver' && <DriverView />}
        {activeRole === 'business' && <BusinessView />}
        {activeRole === 'admin' && <AdminView />}
      </div>
    </div>
  )
}
