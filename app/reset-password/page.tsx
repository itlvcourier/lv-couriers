'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { ArrowLeft, CheckCircle, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Check if we have a valid recovery session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      // Check if this is a recovery session (user came from reset email)
      if (session) {
        setIsValidSession(true)
      } else {
        setIsValidSession(false)
      }
    }
    
    checkSession()
  }, [supabase.auth])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate passwords
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Check for password strength
    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    
    if (!hasUppercase || !hasLowercase || !hasNumber) {
      setError('Password must contain uppercase, lowercase, and a number')
      return
    }

    setIsLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    })

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    setIsSuccess(true)
    setIsLoading(false)

    // Sign out and redirect to login after 3 seconds
    setTimeout(async () => {
      await supabase.auth.signOut()
      router.push('/login')
    }, 3000)
  }

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  // Invalid session - no recovery token
  if (isValidSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-1 mb-2">
              <span className="text-4xl font-bold text-[var(--accent-orange)]">LV</span>
              <span className="text-4xl font-normal text-foreground">COURIER</span>
            </div>
          </div>

          <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
            <CardContent className="pt-6">
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-[var(--accent-red)]/10 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-6 h-6 text-[var(--accent-red)]" />
                </div>
                <h2 className="text-xl font-medium text-foreground mb-2">Invalid or Expired Link</h2>
                <p className="text-sm text-muted-foreground">
                  This password reset link is invalid or has expired. Please request a new one.
                </p>
                <Link href="/forgot-password">
                  <Button 
                    className="mt-6 w-full h-11 rounded-xl bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white"
                  >
                    Request New Link
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
      <div className="w-full max-w-md">
        {/* Back link */}
        <Link 
          href="/login" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-1 mb-2">
            <span className="text-4xl font-bold text-[var(--accent-orange)]">LV</span>
            <span className="text-4xl font-normal text-foreground">COURIER</span>
          </div>
          <p className="text-muted-foreground text-sm">Delivery Operations</p>
        </div>

        {/* Card */}
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="pt-6">
            {isSuccess ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-[var(--accent-green)]/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-[var(--accent-green)]" />
                </div>
                <h2 className="text-xl font-medium text-foreground mb-2">Password Updated</h2>
                <p className="text-sm text-muted-foreground">
                  Your password has been changed successfully. Redirecting to login...
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-medium text-foreground">Set New Password</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your new password below
                  </p>
                </div>
                
                <form onSubmit={handleSubmit}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="password">New Password</FieldLabel>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter new password"
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
                      <p className="text-xs text-muted-foreground mt-1">
                        At least 8 characters with uppercase, lowercase, and number
                      </p>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
                      <Input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className={`h-11 bg-[var(--bg-card-2)] border-[var(--border-color)] text-foreground placeholder:text-muted-foreground ${error ? 'border-[var(--accent-red)]' : ''}`}
                      />
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
                          Updating...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                  </FieldGroup>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
