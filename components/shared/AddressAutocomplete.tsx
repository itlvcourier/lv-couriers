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
 * Parse the new Places API `AddressComponent[]` into a structured object.
 * The new API exposes `longText`/`shortText`/`types` (vs the legacy
 * `long_name`/`short_name`/`types`).
 */
function parseAddressComponents(
  components: google.maps.places.AddressComponent[],
): AddressComponents {
  const result: AddressComponents = {}

  for (const component of components) {
    const types = component.types
    if (types.includes('street_number')) {
      result.streetNumber = component.longText ?? undefined
    } else if (types.includes('route')) {
      result.streetName = component.longText ?? undefined
    } else if (types.includes('locality')) {
      result.city = component.longText ?? undefined
    } else if (types.includes('administrative_area_level_1')) {
      result.province = component.shortText ?? undefined
    } else if (types.includes('postal_code')) {
      result.postalCode = component.longText ?? undefined
    } else if (types.includes('country')) {
      result.country = component.shortText ?? undefined
    }
  }

  return result
}

interface Suggestion {
  placeId: string
  text: string
}

/**
 * Google Places address autocomplete.
 *
 * Uses the modern `AutocompleteSuggestion.fetchAutocompleteSuggestions` API
 * instead of the legacy `google.maps.places.Autocomplete` widget, which is no
 * longer available to Google Maps customers created after March 1, 2025. We
 * render our own dropdown so the styled input + icon are preserved, and use a
 * session token so autocomplete + details are billed as one session.
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
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Session token for billing; regenerated after each completed selection.
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guards against stale async responses overwriting newer ones.
  const requestSeqRef = useRef(0)

  // Load Google Maps via the shared loader (single script tag, all libraries).
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    loadGoogleMaps()
      .then(() => {
        if (cancelled) return
        // The shared loader resolves only after the Places library is present,
        // so `google.maps.places.AutocompleteSuggestion` is ready to use.
        if (!google.maps.places?.AutocompleteSuggestion) {
          console.error('[v0] Places AutocompleteSuggestion API unavailable')
          setIsLoading(false)
          return
        }
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

  const newSessionToken = useCallback(() => {
    sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken()
  }, [])

  // Fetch predictions for the current input (debounced by the caller).
  const fetchSuggestions = useCallback(
    async (input: string) => {
      if (!isLoaded || input.trim().length < 3) {
        setSuggestions([])
        setOpen(false)
        return
      }
      if (!sessionTokenRef.current) newSessionToken()

      const seq = ++requestSeqRef.current
      try {
        const { suggestions: results } =
          await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input,
            sessionToken: sessionTokenRef.current ?? undefined,
            includedRegionCodes: ['ca'], // Restrict to Canada
          })

        // Ignore if a newer request has since fired.
        if (seq !== requestSeqRef.current) return

        const mapped: Suggestion[] = results
          .map((s) => s.placePrediction)
          .filter((p): p is google.maps.places.PlacePrediction => !!p)
          .map((p) => ({ placeId: p.placeId, text: p.text.text }))

        setSuggestions(mapped)
        setOpen(mapped.length > 0)
        setActiveIndex(-1)
      } catch (err) {
        console.error('[v0] Autocomplete fetch failed:', err)
        setSuggestions([])
        setOpen(false)
      }
    },
    [isLoaded, newSessionToken],
  )

  // Resolve a selected prediction into full place details.
  const selectSuggestion = useCallback(
    async (suggestion: Suggestion) => {
      setOpen(false)
      setSuggestions([])
      onChange(suggestion.text)

      try {
        const place = new google.maps.places.Place({
          id: suggestion.placeId,
          requestedLanguage: 'en',
        })
        await place.fetchFields({
          fields: ['formattedAddress', 'location', 'addressComponents'],
        })

        const result: AddressResult = {
          address: place.formattedAddress ?? suggestion.text,
          placeId: suggestion.placeId,
          lat: place.location?.lat(),
          lng: place.location?.lng(),
          components: place.addressComponents
            ? parseAddressComponents(place.addressComponents)
            : undefined,
        }

        onChange(result.address)
        onSelect?.(result)
      } catch (err) {
        console.error('[v0] Place details fetch failed:', err)
        // Fall back to the prediction text we already set.
        onSelect?.({ address: suggestion.text, placeId: suggestion.placeId })
      } finally {
        // The session concluded with fetchFields; start a fresh one.
        newSessionToken()
      }
    },
    [onChange, onSelect, newSessionToken],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value
      onChange(next)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => void fetchSuggestions(next), 250)
    },
    [onChange, fetchSuggestions],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open || suggestions.length === 0) {
        // Still prevent Enter from submitting the form while typing an address.
        if (e.key === 'Enter' && open) e.preventDefault()
        return
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((i) => (i + 1) % suggestions.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
          break
        case 'Enter':
          e.preventDefault()
          e.stopPropagation()
          if (activeIndex >= 0 && activeIndex < suggestions.length) {
            void selectSuggestion(suggestions[activeIndex])
          }
          break
        case 'Escape':
          setOpen(false)
          break
      }
    },
    [open, suggestions, activeIndex, selectSuggestion],
  )

  // Close the dropdown when clicking outside.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Cleanup debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
      <Input
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true)
        }}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        required={required}
        className={cn('pl-9 text-sm truncate', className)}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {isLoading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={s.placeId} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => {
                  // mousedown (not click) so it fires before input blur.
                  e.preventDefault()
                  void selectSuggestion(s)
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors',
                  i === activeIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'text-popover-foreground hover:bg-accent/50',
                )}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{s.text}</span>
              </button>
            </li>
          ))}
        </ul>
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
