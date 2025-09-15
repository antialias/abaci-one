import type { Metadata } from 'next'
import './globals.css'
import { AbacusDisplayProvider } from '@/contexts/AbacusDisplayContext'
import { AppNavBar } from '@/components/AppNavBar'

export const metadata: Metadata = {
  title: 'Soroban Flashcard Generator',
  description: 'Create beautiful, educational soroban flashcards with authentic Japanese abacus representations',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AbacusDisplayProvider>
          <AppNavBar />
          {children}
        </AbacusDisplayProvider>
      </body>
    </html>
  )
}