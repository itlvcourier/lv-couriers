'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/lib/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { login } = useApp()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800))

    const result = login(email, password)
    
    if (!result.success) {
      setError(result.error || 'Login failed')
      setIsLoading(false)
      return
    }

    // Route based on role
    switch (result.role) {
      case 'admin':
        router.push('/admin/dashboard')
        break
      case 'driver':
        router.push('/driver')
        break
      case 'business':
        router.push('/business')
        break
      default:
        router.push('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-1 mb-2">
            <span className="text-4xl font-bold text-[var(--accent-orange)]">LV</span>
            <span className="text-4xl font-normal text-foreground">COURIER</span>
          </div>
          <p className="text-muted-foreground text-sm">Delivery Operations</p>
        </div>

        {/* Login Card */}
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="pt-6">
            <div className="mb-6">
              <h2 className="text-xl font-medium text-foreground">Sign In</h2>
              <p className="text-sm text-muted-foreground mt-1">Enter your credentials to continue</p>
            </div>
            
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
                    className={`h-11 bg-[var(--bg-card-2)] border-[var(--border-color)] text-foreground placeholder:text-muted-foreground ${error ? 'border-[var(--accent-red)]' : ''}`}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className={`h-11 bg-[var(--bg-card-2)] border-[var(--border-color)] text-foreground placeholder:text-muted-foreground pr-10 ${error ? 'border-[var(--accent-red)]' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
                
                {error && (
                  <p className="text-sm text-[var(--accent-red)]">{error}</p>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white rounded-xl tap-target" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </FieldGroup>
            </form>
            
            <div className="mt-4 text-right">
              <Link 
                href="/forgot-password" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Demo Credentials */}
        <Card className="mt-4 bg-[var(--bg-card)] border-[var(--border-color)] border-dashed">
          <CardContent className="py-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Demo credentials:</p>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center p-2 bg-[var(--bg-card-2)] rounded-lg">
                <span className="text-muted-foreground">Admin</span>
                <span className="text-foreground">admin@lvcourier.ca / admin123</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-[var(--bg-card-2)] rounded-lg">
                <span className="text-muted-foreground">Driver</span>
                <span className="text-foreground">marcus@lvcourier.ca / driver123</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-[var(--bg-card-2)] rounded-lg">
                <span className="text-muted-foreground">Business</span>
                <span className="text-foreground">freshmart@lvcourier.ca / business123</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
