'use client'

import { Building2, MapPin } from 'lucide-react'
import type { DbBusiness } from '@/lib/types'

interface BusinessHeaderProps {
  business: DbBusiness
}

export function BusinessHeader({ business }: BusinessHeaderProps) {
  return (
    <div className="bg-card/50 border-b border-border p-4">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">{business.name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {business.address.split(',')[0]}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
