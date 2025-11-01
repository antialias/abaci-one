'use client'

import { AbacusDisplayProvider } from '@soroban/abacus-react'
import { QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { type ReactNode, useState } from 'react'
import { ToastProvider } from '@/components/common/ToastContext'
import { FullscreenProvider } from '@/contexts/FullscreenContext'
import { GameModeProvider } from '@/contexts/GameModeContext'
import { UserProfileProvider } from '@/contexts/UserProfileContext'
import { LocaleProvider, useLocaleContext } from '@/contexts/LocaleContext'
import { createQueryClient } from '@/lib/queryClient'
import { type Locale } from '@/i18n/messages'
import { AbacusSettingsSync } from './AbacusSettingsSync'
import { DeploymentInfo } from './DeploymentInfo'

interface ClientProvidersProps {
  children: ReactNode
  initialLocale: Locale
  initialMessages: Record<string, any>
}

function InnerProviders({ children }: { children: ReactNode }) {
  const { locale, messages } = useLocaleContext()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
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
    </NextIntlClientProvider>
  )
}

export function ClientProviders({
  children,
  initialLocale,
  initialMessages,
}: ClientProvidersProps) {
  // Create a stable QueryClient instance that persists across renders
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale={initialLocale} initialMessages={initialMessages}>
        <InnerProviders>{children}</InnerProviders>
      </LocaleProvider>
    </QueryClientProvider>
  )
}
