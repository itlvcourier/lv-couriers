'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MapPin, Loader2 } from 'lucide-react'

export interface AddressResult {
  address: string
  placeId: string
  lat?: number
  lng?: number
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

  // Load Google Maps script
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      console.error('[v0] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not configured')
      return
    }

    // Check if already loaded
    if (window.google?.maps?.places) {
      setIsLoaded(true)
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    )
    if (existingScript) {
      existingScript.addEventListener('load', () => setIsLoaded(true))
      return
    }

    // Load the script
    setIsLoading(true)
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      setIsLoaded(true)
      setIsLoading(false)
    }
    script.onerror = () => {
      console.error('[v0] Failed to load Google Maps script')
      setIsLoading(false)
    }
    document.head.appendChild(script)
  }, [])

  // Initialize autocomplete when script is loaded
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'ca' }, // Restrict to Canada
      fields: ['formatted_address', 'place_id', 'geometry'],
      types: ['address'],
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.formatted_address) return

      const result: AddressResult = {
        address: place.formatted_address,
        placeId: place.place_id || '',
        lat: place.geometry?.location?.lat(),
        lng: place.geometry?.location?.lng(),
      }

      onChange(result.address)
      onSelect?.(result)
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
        placeholder={placeholder}
        disabled={disabled || isLoading}
        required={required}
        className={cn('pl-9', className)}
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
