'use client'

import { useApp } from '@/lib/context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2, ChevronDown } from 'lucide-react'
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
  
  if (!currentUser || currentUser.role !== 'business') {
    return null
  }
  
  const accessibleLocations = getAccessibleLocations()
  const userIsOwner = isOwner()
  
  // Single location - no switcher needed
  if (accessibleLocations.length <= 1 && !userIsOwner) {
    return null
  }
  
  const business = businesses.find(b => b.id === currentUser.businessId)
  if (!business) return null
  
  const currentLocation = activeLocationId === 'all' 
    ? null 
    : accessibleLocations.find(l => l.id === activeLocationId)
  
  return (
    <div className="flex items-center gap-2">
      <Select
        value={activeLocationId === 'all' ? 'all' : (activeLocationId || '')}
        onValueChange={(value) => setActiveLocation(value as string | 'all')}
      >
        <SelectTrigger className="w-[200px] h-9 bg-muted/50 border-border/50">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <SelectValue placeholder="Select location">
              {activeLocationId === 'all' ? (
                <span className="flex items-center gap-2">
                  All Locations
                  <Badge variant="secondary" className="text-xs py-0 px-1.5">
                    {accessibleLocations.length}
                  </Badge>
                </span>
              ) : (
                <span className="truncate">
                  {currentLocation?.name || 'Select location'}
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
    </div>
  )
}
