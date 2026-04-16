'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

type Props = {
  /** Optional id used by the Switch for accessibility. */
  id?: string
}

/**
 * Reusable settings row that flips the app between light and dark mode.
 * Wires into next-themes so the choice is persisted across reloads.
 */
export function ThemeToggleRow({ id = 'dark-mode-toggle' }: Props) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — theme is only known on the client.
  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : true

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        {isDark ? (
          <Moon className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        ) : (
          <Sun className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        )}
        <div>
          <label htmlFor={id} className="text-sm font-medium text-foreground cursor-pointer">
            Dark Mode
          </label>
          <p className="text-xs text-muted-foreground">
            {mounted ? (isDark ? 'Using dark theme' : 'Using light theme') : 'Loading...'}
          </p>
        </div>
      </div>
      <Switch
        id={id}
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        disabled={!mounted}
        aria-label="Toggle dark mode"
      />
    </div>
  )
}
