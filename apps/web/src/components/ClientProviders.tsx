'use client'

import { ReactNode } from 'react'
import { AbacusDisplayProvider } from '@soroban/abacus-react'
import { UserProfileProvider } from '@/contexts/UserProfileContext'
import { GameModeProvider } from '@/contexts/GameModeContext'
import { FullscreenProvider } from '@/contexts/FullscreenContext'
import { DeploymentInfo } from './DeploymentInfo'

interface ClientProvidersProps {
  children: ReactNode
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <AbacusDisplayProvider>
      <UserProfileProvider>
        <GameModeProvider>
          <FullscreenProvider>
            {children}
            <DeploymentInfo />
          </FullscreenProvider>
        </GameModeProvider>
      </UserProfileProvider>
    </AbacusDisplayProvider>
  )
}