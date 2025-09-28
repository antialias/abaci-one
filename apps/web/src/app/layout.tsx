import type { Metadata } from 'next'
import './globals.css'
import { AbacusDisplayProvider } from '@/contexts/AbacusDisplayContext'
import { UserProfileProvider } from '@/contexts/UserProfileContext'
import { GameModeProvider } from '@/contexts/GameModeContext'
import { FullscreenProvider } from '@/contexts/FullscreenContext'
import { GameThemeProvider } from '@/contexts/GameThemeContext'
import { AppNavBar } from '@/components/AppNavBar'

export const metadata: Metadata = {
  title: 'Soroban Flashcard Generator',
  description: 'Create beautiful, educational soroban flashcards with authentic Japanese abacus representations',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
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
            <GameModeProvider>
              <FullscreenProvider>
                <GameThemeProvider>
                  <AppNavBar />
                  {children}
                </GameThemeProvider>
              </FullscreenProvider>
            </GameModeProvider>
          </UserProfileProvider>
        </AbacusDisplayProvider>
      </body>
    </html>
  )
}