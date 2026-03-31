'use client'

import { cn } from '@/lib/utils'
import { useApp } from '@/lib/context'
import { Truck, Building2, Shield } from 'lucide-react'
import type { UserRole } from '@/lib/types'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const roles: { role: UserRole; label: string; icon: typeof Truck }[] = [
  { role: 'driver', label: 'Driver', icon: Truck },
  { role: 'business', label: 'Business', icon: Building2 },
  { role: 'admin', label: 'Admin', icon: Shield },
]

export function RoleSwitcher() {
  const { activeRole, setActiveRole } = useApp()

  return (
    <TooltipProvider>
      <div className="fixed top-4 right-4 z-50">
        {/* Desktop version */}
        <div className="hidden sm:flex items-center gap-1 p-1 bg-[#141720] border border-[#1f2535] rounded-full shadow-lg">
          {roles.map(({ role, label, icon: Icon }) => (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                activeRole === role
                  ? 'bg-orange-500 text-white'
                  : 'text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#1a1e2a]'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Mobile version - icons only */}
        <div className="flex sm:hidden items-center gap-1 p-1 bg-[#141720] border border-[#1f2535] rounded-full shadow-lg">
          {roles.map(({ role, label, icon: Icon }) => (
            <Tooltip key={role}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveRole(role)}
                  className={cn(
                    'w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200',
                    activeRole === role
                      ? 'bg-orange-500 text-white'
                      : 'text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#1a1e2a]'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
