'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-card)] border-b border-[var(--border-color)]">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link 
            href="/login" 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </Link>
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-[var(--accent-orange)]">LV</span>
            <span className="text-lg font-normal text-foreground">COURIER</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 pb-16">
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: January 2025</p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                LV Courier (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the Delivery Operations Management System (DOMS). 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our 
                delivery management platform and mobile applications.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">2. Information We Collect</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">We collect information that you provide directly to us, including:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li><strong className="text-foreground">Account Information:</strong> Name, email address, phone number, and password when you create an account.</li>
                <li><strong className="text-foreground">Business Information:</strong> Company name, business address, billing details, and contact information for business accounts.</li>
                <li><strong className="text-foreground">Driver Information:</strong> Driver&apos;s license, vehicle information, insurance details, and banking information for payment processing.</li>
                <li><strong className="text-foreground">Delivery Information:</strong> Pickup and delivery addresses, recipient contact details, package descriptions, and delivery instructions.</li>
                <li><strong className="text-foreground">Location Data:</strong> Real-time GPS location for drivers during active deliveries to enable tracking and route optimization.</li>
                <li><strong className="text-foreground">Photos and Signatures:</strong> Proof of pickup and delivery photos, and electronic signatures for delivery confirmation.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">We use the information we collect to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Facilitate delivery operations and provide our services</li>
                <li>Process payments and generate invoices</li>
                <li>Enable real-time delivery tracking for businesses and recipients</li>
                <li>Send notifications about delivery status updates</li>
                <li>Calculate driver earnings and process payroll</li>
                <li>Improve our services and develop new features</li>
                <li>Communicate with you about your account and our services</li>
                <li>Comply with legal obligations and resolve disputes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. Information Sharing</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">We may share your information with:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li><strong className="text-foreground">Business Partners:</strong> Delivery details shared with businesses for their orders.</li>
                <li><strong className="text-foreground">Recipients:</strong> Tracking information and delivery updates shared via SMS or email.</li>
                <li><strong className="text-foreground">Service Providers:</strong> Third-party services for payment processing, mapping, and communications.</li>
                <li><strong className="text-foreground">Legal Requirements:</strong> When required by law or to protect our rights and safety.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal information against 
                unauthorized access, alteration, disclosure, or destruction. This includes encryption of data in transit and at rest, 
                secure authentication mechanisms, and regular security assessments.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your personal information for as long as necessary to provide our services and fulfill the purposes 
                outlined in this policy. Delivery records and invoices are retained for a minimum of 7 years for accounting and 
                legal compliance purposes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">You have the right to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Access and receive a copy of your personal data</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your data (subject to legal retention requirements)</li>
                <li>Opt-out of marketing communications</li>
                <li>Withdraw consent for location tracking (may affect service availability)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Cookies and Tracking</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use cookies and similar technologies to maintain your session, remember your preferences, and analyze 
                usage patterns. You can control cookie settings through your browser preferences.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">9. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting 
                the new policy on this page and updating the &quot;Last updated&quot; date.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">10. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="mt-3 p-4 bg-[var(--bg-card-2)] rounded-lg">
                <p className="text-foreground font-medium">LV Courier</p>
                <p className="text-muted-foreground text-sm">Email: privacy@lvcourier.ca</p>
                <p className="text-muted-foreground text-sm">Phone: (604) 555-0123</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} LV Courier. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-sm text-[var(--accent-orange)] font-medium">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
