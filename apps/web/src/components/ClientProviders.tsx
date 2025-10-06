'use client'

import { ReactNode, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { AbacusDisplayProvider } from '@soroban/abacus-react'
import { UserProfileProvider } from '@/contexts/UserProfileContext'
import { GameModeProvider } from '@/contexts/GameModeContext'
import { FullscreenProvider } from '@/contexts/FullscreenContext'
import { DeploymentInfo } from './DeploymentInfo'
import { AbacusSettingsSync } from './AbacusSettingsSync'
import { createQueryClient } from '@/lib/queryClient'

interface ClientProvidersProps {
  children: ReactNode
}

export function ClientProviders({ children }: ClientProvidersProps) {
  // Create a stable QueryClient instance that persists across renders
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <AbacusDisplayProvider>
        <AbacusSettingsSync />
        <UserProfileProvider>
          <GameModeProvider>
            <FullscreenProvider>
              {children}
              <DeploymentInfo />
            </FullscreenProvider>
          </GameModeProvider>
        </UserProfileProvider>
      </AbacusDisplayProvider>
    </QueryClientProvider>
  )
}