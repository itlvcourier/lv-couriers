'use client'

import { useApp } from '@/lib/context'
import { BusinessCard } from '@/components/shared/BusinessCard'

interface BusinessesProps {
  onViewBusinessDeliveries: (businessId: string) => void
}

export function Businesses({ onViewBusinessDeliveries }: BusinessesProps) {
  const { businesses } = useApp()

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold text-[#e8eaf0]">Businesses</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {businesses.map(business => (
          <BusinessCard
            key={business.id}
            business={business}
            onViewDeliveries={() => onViewBusinessDeliveries(business.id)}
          />
        ))}
      </div>
    </div>
  )
}
