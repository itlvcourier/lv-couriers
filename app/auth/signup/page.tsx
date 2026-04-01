'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Truck, Building2, UserCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'business' | 'driver'>('business')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (!email || !password) {
        setError('Please fill in all fields')
        setIsLoading(false)
        return
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        setIsLoading(false)
        return
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            name: role === 'driver' ? 'Driver User' : 'Business User',
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setIsLoading(false)
        return
      }

      if (data?.user) {
        toast.success('Account created! You can now sign in.')
        setTimeout(() => {
          window.location.href = '/auth/login'
        }, 1500)
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-accent via-accent/90 to-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34c0-2 2-4 2-4s2 2 2 4-2 4-2 4-2-2-2-4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"}}></div>
        <div className="relative z-10 flex flex-col justify-center p-12 text-accent-foreground">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Truck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">LV Couriers</h1>
              <p className="text-accent-foreground/80">Fast. Reliable. Local.</p>
            </div>
          </div>
          
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            Join Our Network
          </h2>
          <p className="text-lg text-accent-foreground/80 mb-12 max-w-md">
            Whether you are a business looking to ship or a driver ready to deliver, we have got you covered.
          </p>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">For Businesses</h3>
                <p className="text-accent-foreground/70">Post deliveries and track them in real-time. Pay only for what you ship.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <UserCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">For Drivers</h3>
                <p className="text-accent-foreground/70">Pick up jobs on your schedule. Earn money delivering locally.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Easy to Start</h3>
                <p className="text-accent-foreground/70">Sign up in minutes. No upfront costs or commitments.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Signup form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
              <Truck className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">LV Couriers</h1>
              <p className="text-sm text-muted-foreground">Join our network</p>
            </div>
          </div>

          <Card className="border-border/50 shadow-xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
              <CardDescription>Get started with LV Couriers</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignup}>
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
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="role">I am a</FieldLabel>
                    <Select value={role} onValueChange={(value: 'business' | 'driver') => setRole(value)} disabled={isLoading}>
                      <SelectTrigger id="role" className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="business">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-primary" />
                            <span>Business</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="driver">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-accent" />
                            <span>Driver</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {error && (
                    <FieldError>{error}</FieldError>
                  )}
                  <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
                    {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : null}
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </FieldGroup>
              </form>
              
              <div className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </div>
              
              <div className="mt-6 bg-secondary/50 p-4 rounded-xl border border-border">
                <p className="text-xs font-semibold text-foreground mb-3">Demo Accounts Available:</p>
                <div className="space-y-2 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 bg-background rounded-lg gap-1">
                    <span className="text-muted-foreground">Business</span>
                    <code className="text-foreground font-mono text-[10px] sm:text-xs">business@demo.lvcouriers.com</code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 bg-background rounded-lg gap-1">
                    <span className="text-muted-foreground">Driver</span>
                    <code className="text-foreground font-mono text-[10px] sm:text-xs">driver@demo.lvcouriers.com</code>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg mt-2">
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
