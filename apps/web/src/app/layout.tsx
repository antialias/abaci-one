import type { Metadata } from 'next'
import './globals.css'
import { AbacusDisplayProvider } from '@/contexts/AbacusDisplayContext'
import { UserProfileProvider } from '@/contexts/UserProfileContext'
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
          <UserProfileProvider>
            <AppNavBar />
            {children}
          </UserProfileProvider>
        </AbacusDisplayProvider>
      </body>
    </html>
  )
}