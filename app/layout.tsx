import type { Metadata, Viewport } from 'next'
import { Inter, Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { AppProvider } from '@/lib/context'
import { ThemeProvider } from '@/components/theme-provider'
import { NativeAppProvider } from '@/components/native/NativeAppProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
const geist = Geist({ subsets: ['latin'], variable: '--font-display' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'DOMS - Delivery Operations Management System',
  description: 'DOMS By Atria360 - Delivery management for drivers, businesses, and administrators',
  generator: 'v0',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0f14' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.className} ${geist.variable} ${geistMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-background text-foreground min-h-screen">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AppProvider>
            <NativeAppProvider />
            {children}
          </AppProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              },
            }}
          />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
