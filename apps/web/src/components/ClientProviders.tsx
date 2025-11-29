'use client'

import { AbacusDisplayProvider } from '@soroban/abacus-react'
import { QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { type ReactNode, useState } from 'react'
import { ToastProvider } from '@/components/common/ToastContext'
import { DeploymentInfoProvider } from '@/contexts/DeploymentInfoContext'
import { FullscreenProvider } from '@/contexts/FullscreenContext'
import { GameModeProvider } from '@/contexts/GameModeContext'
import { HomeHeroProvider } from '@/contexts/HomeHeroContext'
import { LocaleProvider, useLocaleContext } from '@/contexts/LocaleContext'
import { MyAbacusProvider } from '@/contexts/MyAbacusContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { UserProfileProvider } from '@/contexts/UserProfileContext'
import { VisualDebugProvider } from '@/contexts/VisualDebugContext'
import type { Locale } from '@/i18n/messages'
import { createQueryClient } from '@/lib/queryClient'
import { AbacusSettingsSync } from './AbacusSettingsSync'
import { DeploymentInfo } from './DeploymentInfo'
import { MyAbacus } from './MyAbacus'

interface ClientProvidersProps {
  children: ReactNode
  initialLocale: Locale
  initialMessages: Record<string, any>
}

function InnerProviders({ children }: { children: ReactNode }) {
  const { locale, messages } = useLocaleContext()

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <ToastProvider>
        <AbacusDisplayProvider>
          <AbacusSettingsSync />
          <UserProfileProvider>
            <GameModeProvider>
              <FullscreenProvider>
                <HomeHeroProvider>
                  <MyAbacusProvider>
                    <DeploymentInfoProvider>
                      {children}
                      <DeploymentInfo />
                      <MyAbacus />
                    </DeploymentInfoProvider>
                  </MyAbacusProvider>
                </HomeHeroProvider>
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
      <ThemeProvider>
        <VisualDebugProvider>
          <LocaleProvider initialLocale={initialLocale} initialMessages={initialMessages}>
            <InnerProviders>{children}</InnerProviders>
          </LocaleProvider>
        </VisualDebugProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
