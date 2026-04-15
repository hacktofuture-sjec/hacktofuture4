import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { PublicRouteThemeReset } from '@/components/theme/public-route-theme-reset'

const geist = Geist({ subsets: ["latin"], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'MicroChat - Real-Time Messaging & System Monitoring',
  description: 'Advanced real-time chat application with AI-driven self-healing cloud platform for autonomous system monitoring and recovery',
  keywords: ['chat', 'messaging', 'microservices', 'monitoring', 'self-healing', 'real-time'],
  creator: 'MicroChat Team',
  openGraph: {
    title: 'MicroChat - Real-Time Chat & Self-Healing Platform',
    description: 'Real-time chat with integrated microservices architecture and autonomous system monitoring',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a1a' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased bg-black text-white`}>
        <PublicRouteThemeReset />
        <div className="relative min-h-screen">
          {children}
        </div>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
