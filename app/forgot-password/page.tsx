'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    // Use Supabase Auth's native password reset. It always returns success
    // for security (so we don't leak which emails exist).
    const supabase = createSupabaseClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
    })

    if (resetError) {
      setError(resetError.message)
      setIsLoading(false)
      return
    }

    setIsSuccess(true)
    setIsLoading(false)
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
                <h2 className="text-xl font-medium text-foreground mb-2">Check your inbox</h2>
                <p className="text-sm text-muted-foreground">
                  Reset link sent to <span className="text-foreground">{email}</span>
                </p>
                <Link href="/login">
                  <Button 
                    variant="outline" 
                    className="mt-6 w-full h-11 rounded-xl border-[var(--border-color)]"
                  >
                    Return to login
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-medium text-foreground">Reset Password</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your email and we&apos;ll send you a reset link
                  </p>
                </div>
                
                <form onSubmit={handleSubmit}>
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
                          Sending...
                        </>
                      ) : (
                        'Send Reset Link'
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
