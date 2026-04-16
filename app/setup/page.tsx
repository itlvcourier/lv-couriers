'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

type SetupUserResult = {
  email: string
  success: boolean
  error?: string
}
type SetupResponse = {
  message: string
  results: SetupUserResult[]
  error?: string
}

export default function SetupPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SetupResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setupDemoUsers = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/setup-demo-users')
      const data: SetupResponse = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Setup failed')
      } else {
        setResult(data)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Setup Demo Accounts</CardTitle>
          <CardDescription>Click the button below to create demo users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={setupDemoUsers} 
            disabled={loading}
            className="w-full"
          >
            {loading ? <Spinner className="mr-2" /> : null}
            {loading ? 'Setting up...' : 'Create Demo Users'}
          </Button>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {result && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm font-medium text-green-600 mb-2">{result.message}</p>
              <div className="space-y-1">
                {result.results.map(r => (
                  <div key={r.email} className="text-xs">
                    <p className={r.success ? 'text-green-600' : 'text-red-600'}>
                      {r.email}: {r.success ? 'Created' : `Failed: ${r.error ?? 'unknown'}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground font-medium mb-2">Demo Credentials:</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p><strong>Admin:</strong> admin@lvcourier.ca / admin123</p>
              <p><strong>Driver:</strong> marcus@lvcourier.ca / driver123</p>
              <p><strong>Business:</strong> freshmart@lvcourier.ca / business123</p>
            </div>
          </div>

          <div className="text-center">
            <a href="/login" className="text-sm text-primary hover:underline">
              Go to Login →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
