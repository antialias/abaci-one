import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ClientProviders } from '@/components/ClientProviders'
import { getRequestLocale } from '@/i18n/request'
import { getMessages } from '@/i18n/messages'

export const metadata: Metadata = {
  metadataBase: new URL('https://abaci.one'),
  title: {
    default: 'Abaci One — Adaptive Abacus Math Practice for Kids',
    template: '%s | Abaci One',
  },
  description:
    'Screen time that builds real math skills. Adaptive daily practice, printable materials, and multiplayer math games — all built around the world\'s most effective mental math tool.',
  keywords: [
    'soroban',
    'abacus',
    'Japanese abacus',
    'mental arithmetic',
    'math games',
    'abacus tutorial',
    'soroban learning',
    'arithmetic practice',
    'educational games',
    'math practice for kids',
    'adaptive math',
    'mental math for kids',
    'abacus for kids',
    'math screen time',
  ],
  authors: [{ name: 'Abaci One' }],
  creator: 'Abaci One',
  publisher: 'Abaci One',

  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['de_DE', 'ja_JP', 'hi_IN', 'es_ES', 'la'],
    url: 'https://abaci.one',
    title: 'Abaci One — Adaptive Abacus Math Practice for Kids',
    description:
      'Screen time that builds real math skills. Adaptive daily practice, printable materials, and multiplayer math games — all built around the world\'s most effective mental math tool.',
    siteName: 'Abaci One',
  },

  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'Abaci One — Adaptive Abacus Math Practice for Kids',
    description:
      'Adaptive abacus math practice for kids. Daily practice that adapts, multiplayer math games, and printable materials.',
  },

  // Icons
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },

  // App-specific
  applicationName: 'Abaci One',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Abaci One',
  },

  // Modern web app capable meta tag (non-Apple browsers)
  other: {
    'mobile-web-app-capable': 'yes',
  },

  // Category
  category: 'education',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale()
  const messages = await getMessages(locale)

  return (
    <html lang={locale} suppressHydrationWarning>
      <body data-deploy-test="argocd-2026-01-31">
        <ClientProviders initialLocale={locale} initialMessages={messages}>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
