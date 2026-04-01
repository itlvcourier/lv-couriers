'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Truck, Package, MapPin, Zap, ArrowRight, CheckCircle } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      // Check localStorage first
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      const role = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null

      if (token && role) {
        setAuthenticated(true)
        if (role === 'driver') {
          router.replace('/driver')
        } else if (role === 'business') {
          router.replace('/business')
        } else if (role === 'admin') {
          router.replace('/admin')
        }
        return
      }

      // Fallback to Supabase auth
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setAuthenticated(true)
        const userRole = user.user_metadata?.role || 'driver'
        
        if (userRole === 'driver') {
          router.replace('/driver')
        } else if (userRole === 'business') {
          router.replace('/business')
        } else if (userRole === 'admin') {
          router.replace('/admin')
        }
        return
      }
      
      setLoading(false)
    }

    checkAuth()
  }, [router])

  if (loading || authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Truck className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <Spinner className="w-6 h-6 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Truck className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl text-foreground">LV Couriers</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm" className="gap-2">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 relative">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              <span className="text-primary">Fast</span> &amp; <span className="text-accent">Reliable</span><br />
              Local Delivery
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Streamline your delivery operations with real-time tracking, smart routing, and seamless coordination between businesses and drivers.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="gap-2 h-12 px-8 text-base">
                  Start Delivering <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Why Choose LV Couriers?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for businesses and drivers who need reliable, fast local delivery.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-6 rounded-2xl bg-background border border-border hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">Smart Dispatch</h3>
              <p className="text-muted-foreground">Auto-assign deliveries to the nearest available drivers for maximum efficiency.</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-background border border-border hover:border-accent/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">Live Tracking</h3>
              <p className="text-muted-foreground">Real-time visibility into every delivery from pickup to drop-off.</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-background border border-border hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">Instant Updates</h3>
              <p className="text-muted-foreground">Get notified immediately when your delivery status changes.</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-background border border-border hover:border-accent/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                <Truck className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">Fleet Management</h3>
              <p className="text-muted-foreground">Full visibility and control over your entire delivery operation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-primary to-accent rounded-3xl p-8 sm:p-12 lg:p-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">
              Ready to get started?
            </h2>
            <p className="text-lg text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Join hundreds of businesses and drivers using LV Couriers for their local deliveries.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup">
                <Button size="lg" variant="secondary" className="h-12 px-8 text-base gap-2">
                  Create Free Account <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-primary-foreground/80">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span>Free to start</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span>Setup in minutes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Truck className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">LV Couriers</span>
            </div>
            <p className="text-sm text-muted-foreground">
              2024 LV Couriers. Fast. Reliable. Local.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
