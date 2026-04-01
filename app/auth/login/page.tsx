'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Truck } from 'lucide-react'

export default function LoginPage() {
  console.log('[v0] LoginPage component rendering')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[v0] Form submitted - handleLogin called')
    setError(null)
    setIsLoading(true)

    try {
      console.log('[v0] Attempting login for:', email)
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('[v0] Sign in response:', { user: data?.user?.id, error: signInError?.message })

      if (signInError) {
        console.log('[v0] Sign in error:', signInError.message)
        setError(signInError.message)
        setIsLoading(false)
        return
      }

      if (data.user && data.session) {
        const role = data.user.user_metadata?.role || 'business'
        console.log('[v0] Login successful. User role:', role)
        
        // Store session in localStorage as backup for persistence
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', data.session.access_token)
          localStorage.setItem('user_id', data.user.id)
          localStorage.setItem('user_role', role)
          console.log('[v0] Session stored in localStorage')
        }
        
        let redirectPath = '/business'
        switch (role) {
          case 'driver':
            redirectPath = '/driver'
            break
          case 'admin':
            redirectPath = '/admin'
            break
          case 'business':
          default:
            redirectPath = '/business'
            break
        }
        
        console.log('[v0] Redirecting to:', redirectPath)
        
        // Use Next.js router for client-side navigation (no full page reload)
        router.push(redirectPath)
        
        // Also store in session storage for immediate access
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('just_logged_in', 'true')
        }
      }
    } catch (err) {
      console.log('[v0] Unexpected error:', err)
      setError('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Truck className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">LV Couriers</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </Field>
              {error && (
                <FieldError>{error}</FieldError>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Spinner className="mr-2" /> : null}
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </FieldGroup>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Business owner?{' '}
            <Link href="/auth/signup" className="text-primary hover:underline">
              Create an account
            </Link>
          </div>
          <div className="mt-6 bg-muted/50 p-3 rounded-lg border border-border/50">
            <p className="text-xs text-muted-foreground font-medium mb-2">Demo Accounts:</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p><strong>Business:</strong> business@demo.lvcouriers.com</p>
              <p><strong>Driver:</strong> driver@demo.lvcouriers.com</p>
              <p><strong>Admin:</strong> admin@demo.lvcouriers.com</p>
              <p className="mt-2"><strong>Password:</strong> Demo@123</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
