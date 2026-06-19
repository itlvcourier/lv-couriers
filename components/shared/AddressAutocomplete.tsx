'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MapPin, Loader2 } from 'lucide-react'
import { loadGoogleMaps } from '@/lib/google-maps-loader'

export interface AddressComponents {
  streetNumber?: string
  streetName?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
}

export interface AddressResult {
  address: string
  placeId: string
  lat?: number
  lng?: number
  components?: AddressComponents
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (result: AddressResult) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
  name?: string
  required?: boolean
}

/**
 * Parse Google Places address_components into a structured object
 */
function parseAddressComponents(
  components: google.maps.GeocoderAddressComponent[]
): AddressComponents {
  const result: AddressComponents = {}
  
  for (const component of components) {
    const types = component.types
    
    if (types.includes('street_number')) {
      result.streetNumber = component.long_name
    } else if (types.includes('route')) {
      result.streetName = component.long_name
    } else if (types.includes('locality')) {
      result.city = component.long_name
    } else if (types.includes('administrative_area_level_1')) {
      result.province = component.short_name
    } else if (types.includes('postal_code')) {
      result.postalCode = component.long_name
    } else if (types.includes('country')) {
      result.country = component.short_name
    }
  }
  
  return result
}

/**
 * Google Places Autocomplete component for address input.
 * Provides type-ahead suggestions as the user types.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Enter address...',
  className,
  disabled,
  id,
  name,
  required,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSelectingPlace, setIsSelectingPlace] = useState(false)

  // Load Google Maps via the shared loader so the whole app uses a single
  // script tag with all libraries (places, drawing, geometry, marker). Each
  // component injecting its own `libraries=places` tag previously collided with
  // the zone map's async loader and broke the drawing tools.
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    loadGoogleMaps()
      .then(() => {
        if (cancelled) return
        setIsLoaded(true)
        setIsLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        console.error('[v0] Failed to load Google Maps:', err.message)
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Initialize autocomplete when script is loaded
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'ca' }, // Restrict to Canada
      fields: ['formatted_address', 'place_id', 'geometry', 'address_components'],
      // 'geocode' (vs 'address') lets postal-code-first queries return
      // predictions. With 'address' Google only matches once a street number is
      // present, so typing a postal code returned nothing. 'geocode' surfaces
      // postal codes, intersections, and full street addresses.
      types: ['geocode'],
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.formatted_address) return

      // Parse address components
      const components = place.address_components 
        ? parseAddressComponents(place.address_components)
        : undefined

      const result: AddressResult = {
        address: place.formatted_address,
        placeId: place.place_id || '',
        lat: place.geometry?.location?.lat(),
        lng: place.geometry?.location?.lng(),
        components,
      }

      // Mark that we're selecting a place (to prevent form submission)
      setIsSelectingPlace(true)
      
      onChange(result.address)
      onSelect?.(result)
      
      // Reset the flag after a short delay
      setTimeout(() => setIsSelectingPlace(false), 100)
    })

    autocompleteRef.current = autocomplete
  }, [isLoaded, onChange, onSelect])

  // Handle manual input changes
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value)
    },
    [onChange],
  )

  // Prevent form submission when Enter is pressed while suggestions are showing
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Check if the autocomplete dropdown is open (pac-container is visible)
      const pacContainer = document.querySelector('.pac-container')
      const isDropdownVisible = pacContainer && 
        getComputedStyle(pacContainer).display !== 'none' &&
        pacContainer.querySelectorAll('.pac-item').length > 0
      
      if (isDropdownVisible || isSelectingPlace) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
  }, [isSelectingPlace])

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        required={required}
        className={cn('pl-9 text-sm truncate', className)}
        autoComplete="off"
      />
      {isLoading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}

// Type declaration for Google Maps
declare global {
  interface Window {
    google: typeof google
  }
}
