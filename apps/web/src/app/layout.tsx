import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ClientProviders } from '@/components/ClientProviders'
import { getRequestLocale } from '@/i18n/request'
import { getMessages } from '@/i18n/messages'

export const metadata: Metadata = {
  title: 'Soroban Flashcard Generator',
  description:
    'Create beautiful, educational soroban flashcards with authentic Japanese abacus representations',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale()
  const messages = await getMessages(locale)

  return (
    <html lang={locale}>
      <body>
        <ClientProviders initialLocale={locale} initialMessages={messages}>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
