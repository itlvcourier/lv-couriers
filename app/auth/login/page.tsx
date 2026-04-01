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
import { Truck, Package, MapPin, Zap } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setIsLoading(false)
        return
      }

      if (data.user && data.session) {
        const role = data.user.user_metadata?.role || 'business'
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', data.session.access_token)
          localStorage.setItem('user_id', data.user.id)
          localStorage.setItem('user_role', role)
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
        
        router.push(redirectPath)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-accent relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34c0-2 2-4 2-4s2 2 2 4-2 4-2 4-2-2-2-4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"}}></div>
        <div className="relative z-10 flex flex-col justify-center p-12 text-primary-foreground">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Truck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">LV Couriers</h1>
              <p className="text-primary-foreground/80">Fast. Reliable. Local.</p>
            </div>
          </div>
          
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            Unified Logistics Platform
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-12 max-w-md">
            Streamline your delivery operations with real-time tracking, smart routing, and seamless coordination.
          </p>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">Smart Dispatch</h3>
                <p className="text-sm text-primary-foreground/70">Auto-assign to nearest drivers</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">Live Tracking</h3>
                <p className="text-sm text-primary-foreground/70">Real-time delivery updates</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">Instant Notifications</h3>
                <p className="text-sm text-primary-foreground/70">Stay informed every step</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">Fleet Management</h3>
                <p className="text-sm text-primary-foreground/70">Full visibility and control</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Truck className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">LV Couriers</h1>
              <p className="text-sm text-muted-foreground">Fast. Reliable. Local.</p>
            </div>
          </div>

          <Card className="border-border/50 shadow-xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
              <CardDescription>Sign in to your account to continue</CardDescription>
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
                      className="h-11"
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
                      className="h-11"
                    />
                  </Field>
                  {error && (
                    <FieldError>{error}</FieldError>
                  )}
                  <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
                    {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : null}
                    {isLoading ? 'Signing in...' : 'Sign in'}
                  </Button>
                </FieldGroup>
              </form>
              
              <div className="mt-6 text-center text-sm text-muted-foreground">
                Business owner?{' '}
                <Link href="/auth/signup" className="text-primary font-medium hover:underline">
                  Create an account
                </Link>
              </div>
              
              <div className="mt-6 bg-secondary/50 p-4 rounded-xl border border-border">
                <p className="text-xs font-semibold text-foreground mb-3">Demo Accounts:</p>
                <div className="space-y-2 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 bg-background rounded-lg gap-1">
                    <span className="text-muted-foreground">Business</span>
                    <code className="text-foreground font-mono text-[10px] sm:text-xs">business@demo.lvcouriers.com</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 bg-background rounded-lg gap-1">
                    <span className="text-muted-foreground">Driver</span>
                    <code className="text-foreground font-mono text-[10px] sm:text-xs">driver@demo.lvcouriers.com</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 bg-background rounded-lg gap-1">
                    <span className="text-muted-foreground">Admin</span>
                    <code className="text-foreground font-mono text-[10px] sm:text-xs">admin@demo.lvcouriers.com</code>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg mt-3">
                    <span className="text-muted-foreground">Password</span>
                    <code className="text-primary font-mono font-semibold">Demo@123</code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
