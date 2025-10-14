'use client'

import { AbacusDisplayProvider } from '@soroban/abacus-react'
import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { ToastProvider } from '@/components/common/ToastContext'
import { FullscreenProvider } from '@/contexts/FullscreenContext'
import { GameModeProvider } from '@/contexts/GameModeContext'
import { UserProfileProvider } from '@/contexts/UserProfileContext'
import { createQueryClient } from '@/lib/queryClient'
import { AbacusSettingsSync } from './AbacusSettingsSync'
import { DeploymentInfo } from './DeploymentInfo'

interface ClientProvidersProps {
  children: ReactNode
}

export function ClientProviders({ children }: ClientProvidersProps) {
  // Create a stable QueryClient instance that persists across renders
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
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
      </ToastProvider>
    </QueryClientProvider>
  )
}
