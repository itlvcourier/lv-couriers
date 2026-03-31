'use client'

import { useApp } from '@/lib/context'
import { DriverCard } from '@/components/shared/DriverCard'
import { toast } from 'sonner'

interface DriversProps {
  onViewDriverHistory: (driverId: string) => void
}

export function Drivers({ onViewDriverHistory }: DriversProps) {
  const { drivers, toggleDriverStatus } = useApp()

  const handleToggleStatus = (driverId: string, driverName: string) => {
    toggleDriverStatus(driverId)
    const driver = drivers.find(d => d.id === driverId)
    const newStatus = driver?.status === 'available' ? 'off duty' : 'available'
    toast.success(`${driverName} marked as ${newStatus}`)
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold text-[#e8eaf0]">Drivers</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {drivers.map(driver => (
          <DriverCard
            key={driver.id}
            driver={driver}
            onToggleStatus={() => handleToggleStatus(driver.id, driver.name)}
            onViewHistory={() => onViewDriverHistory(driver.id)}
          />
        ))}
      </div>
    </div>
  )
}
