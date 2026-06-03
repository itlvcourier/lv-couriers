'use client'

import { useEffect } from 'react'
import { useApp } from '@/lib/context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function LocationSwitcher() {
  const { 
    currentUser, 
    businesses, 
    activeLocationId, 
    setActiveLocation,
    getAccessibleLocations,
    isOwner,
  } = useApp()
  
  const userIsOwner = isOwner()
  const accessibleLocations = getAccessibleLocations()
  
  // Auto-set location for non-owners on mount
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'business') return
    
    // For non-owners with single location, auto-set it
    if (!userIsOwner && accessibleLocations.length === 1) {
      if (activeLocationId !== accessibleLocations[0].id) {
        setActiveLocation(accessibleLocations[0].id)
      }
    }
    // For owners, default to "all" if not set
    else if (userIsOwner && (!activeLocationId || activeLocationId === null)) {
      setActiveLocation('all')
    }
  }, [currentUser, userIsOwner, accessibleLocations, activeLocationId, setActiveLocation])
  
  // Don't render for non-business users
  if (!currentUser || currentUser.role !== 'business') {
    return null
  }
  
  // Non-owners with single location - just show a label, no switcher
  if (!userIsOwner && accessibleLocations.length === 1) {
    return (
      <div className="flex flex-col min-w-0">
        <span className="text-xs sm:text-sm font-semibold text-foreground">DOMS</span>
        <span className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[100px] sm:max-w-[140px]">
          {accessibleLocations[0].name}
        </span>
      </div>
    )
  }
  
  // Non-owners with multiple locations but no "all" option
  // Owners get "All Locations" option
  
  const business = businesses.find(b => b.id === currentUser.businessId)
  if (!business) return null
  
  const currentLocation = activeLocationId === 'all' 
    ? null 
    : accessibleLocations.find(l => l.id === activeLocationId)
  
  return (
    <Select
      value={activeLocationId === 'all' ? 'all' : (activeLocationId || accessibleLocations[0]?.id || '')}
      onValueChange={(value) => setActiveLocation(value as string | 'all')}
    >
      <SelectTrigger className="w-auto max-w-[120px] sm:max-w-[160px] h-auto border-0 bg-transparent shadow-none p-0 gap-1 hover:bg-transparent focus:ring-0">
        <div className="flex flex-col items-start min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs sm:text-sm font-semibold text-foreground">DOMS</span>
          </div>
          <SelectValue placeholder="Location">
            {activeLocationId === 'all' ? (
              <span className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                <span>All Locations</span>
                <Badge variant="secondary" className="text-[9px] py-0 px-1 h-3.5">
                  {accessibleLocations.length}
                </Badge>
              </span>
            ) : (
              <span className="truncate text-[10px] sm:text-xs text-muted-foreground">
                {currentLocation?.name || accessibleLocations[0]?.name || 'Location'}
              </span>
            )}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {/* Only owners can see "All Locations" */}
        {userIsOwner && (
          <SelectItem value="all" className="font-medium">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              All Locations
              <Badge variant="secondary" className="text-xs py-0 px-1.5 ml-auto">
                {accessibleLocations.length}
              </Badge>
            </div>
          </SelectItem>
        )}
        
        {accessibleLocations.map((location) => (
          <SelectItem key={location.id} value={location.id}>
            <div className="flex flex-col">
              <span>{location.name}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                {location.address}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
