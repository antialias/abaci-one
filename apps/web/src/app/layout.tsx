import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ClientProviders } from '@/components/ClientProviders'
import { AppNav } from '@/components/AppNav'

export const metadata: Metadata = {
  title: 'Soroban Flashcard Generator',
  description: 'Create beautiful, educational soroban flashcards with authentic Japanese abacus representations',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
  nav,
}: {
  children: React.ReactNode
  nav: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          <AppNav>{nav}</AppNav>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}