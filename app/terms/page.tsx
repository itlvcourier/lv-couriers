'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsOfServicePage() {
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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: January 2025</p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">1. Agreement to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using the LV Courier Delivery Operations Management System (DOMS), you agree to be bound by 
                these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, 
                you are prohibited from using or accessing this service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                LV Courier provides a delivery management platform that connects businesses with delivery drivers. Our services include:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-3">
                <li>Order creation and management for businesses</li>
                <li>Real-time delivery tracking and status updates</li>
                <li>Driver dispatch and route optimization</li>
                <li>Proof of delivery capture (photos and signatures)</li>
                <li>Invoice generation and payment processing</li>
                <li>Reporting and analytics</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">3. User Accounts</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                To use our services, you must create an account. You are responsible for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Providing accurate and complete information</li>
                <li>Notifying us immediately of any unauthorized use</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. Business Users</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                If you are using our service as a business, you agree to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Provide accurate package descriptions and values</li>
                <li>Ensure packages comply with all applicable laws and regulations</li>
                <li>Not ship prohibited items (hazardous materials, illegal goods, etc.)</li>
                <li>Pay all invoices within the agreed payment terms</li>
                <li>Provide accurate pickup and delivery addresses</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. Driver Users</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                If you are using our service as a driver, you agree to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Maintain a valid driver&apos;s license and vehicle insurance</li>
                <li>Handle all packages with care and professionalism</li>
                <li>Complete deliveries in a timely manner</li>
                <li>Capture accurate proof of pickup and delivery</li>
                <li>Keep GPS location services enabled during active deliveries</li>
                <li>Comply with all traffic laws and safety regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. Pricing and Payment</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Delivery pricing is determined by the rate card assigned to each business account. Pricing factors include:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Base delivery rate</li>
                <li>Distance-based pricing (where applicable)</li>
                <li>Rush delivery surcharges</li>
                <li>Package size and quantity</li>
                <li>Applicable taxes (GST)</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                Invoices are generated according to the billing cycle agreed upon with each business. Payment is due within 
                the terms specified on each invoice.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. Cancellation Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Orders may be cancelled at different stages with varying fees:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-3">
                <li><strong className="text-foreground">Before driver dispatch:</strong> No charge</li>
                <li><strong className="text-foreground">After driver dispatch, before pickup:</strong> Cancellation fee may apply</li>
                <li><strong className="text-foreground">After pickup:</strong> Full delivery charge applies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Liability Limitations</h2>
              <p className="text-muted-foreground leading-relaxed">
                LV Courier&apos;s liability for lost or damaged packages is limited to the declared value of the package, 
                up to a maximum of $500 CAD per delivery. We are not liable for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-3">
                <li>Delays caused by weather, traffic, or circumstances beyond our control</li>
                <li>Damage to improperly packaged items</li>
                <li>Loss of business or consequential damages</li>
                <li>Items prohibited from shipping</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">9. Prohibited Items</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                The following items are prohibited from shipping through our service:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Illegal drugs or controlled substances</li>
                <li>Weapons, firearms, or explosives</li>
                <li>Hazardous materials</li>
                <li>Live animals</li>
                <li>Perishable items (unless specifically arranged)</li>
                <li>Cash or bearer instruments</li>
                <li>Any items prohibited by Canadian law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">10. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                The LV Courier platform, including all software, designs, logos, and content, is the property of LV Courier 
                and is protected by intellectual property laws. You may not copy, modify, distribute, or reverse engineer 
                any part of our service without prior written consent.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">11. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to suspend or terminate your account at any time for violation of these terms or 
                for any other reason at our sole discretion. Upon termination, any outstanding balances become immediately 
                due and payable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">12. Dispute Resolution</h2>
              <p className="text-muted-foreground leading-relaxed">
                Any disputes arising from these terms or our services shall be resolved through binding arbitration in 
                accordance with the laws of British Columbia, Canada. The arbitration shall take place in Vancouver, BC.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">13. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting 
                to this page. Your continued use of the service after any changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">14. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                For questions about these Terms of Service, please contact us at:
              </p>
              <div className="mt-3 p-4 bg-[var(--bg-card-2)] rounded-lg">
                <p className="text-foreground font-medium">LV Courier</p>
                <p className="text-muted-foreground text-sm">Email: legal@lvcourier.ca</p>
                <p className="text-muted-foreground text-sm">Phone: (604) 555-0123</p>
                <p className="text-muted-foreground text-sm">Address: Vancouver, BC, Canada</p>
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
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-[var(--accent-orange)] font-medium">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
