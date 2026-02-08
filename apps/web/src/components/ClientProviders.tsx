'use client'

import { AbacusDisplayProvider } from '@soroban/abacus-react'
import { QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import dynamic from 'next/dynamic'
import { type ReactNode, useState } from 'react'
import { ToastProvider } from '@/components/common/ToastContext'
import { AudioHelpProvider } from '@/contexts/AudioHelpContext'
import { DeploymentInfoProvider } from '@/contexts/DeploymentInfoContext'
import { FullscreenProvider } from '@/contexts/FullscreenContext'
import { HomeHeroProvider } from '@/contexts/HomeHeroContext'
import { LocaleProvider, useLocaleContext } from '@/contexts/LocaleContext'
import { MyAbacusProvider } from '@/contexts/MyAbacusContext'
import { PageTransitionProvider } from '@/contexts/PageTransitionContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { UserProfileProvider } from '@/contexts/UserProfileContext'
import { VisualDebugProvider } from '@/contexts/VisualDebugContext'
import type { Locale } from '@/i18n/messages'
import { createQueryClient } from '@/lib/queryClient'
import { AbacusSettingsSync } from './AbacusSettingsSync'
import { DeploymentInfo } from './DeploymentInfo'
import { HeartbeatTracker } from './HeartbeatTracker'
import { PageTransitionOverlay } from './PageTransitionOverlay'

// Lazy load MyAbacus - it includes @react-spring/web, AbacusReact, and Vision components
// Most pages don't need the floating abacus immediately on load
const MyAbacus = dynamic(() => import('./MyAbacus').then((m) => m.MyAbacus), {
  ssr: false,
})

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
            <FullscreenProvider>
              <HomeHeroProvider>
                <MyAbacusProvider>
                  <AudioHelpProvider>
                    <DeploymentInfoProvider>
                      <PageTransitionProvider>
                        {children}
                        <PageTransitionOverlay />
                        <DeploymentInfo />
                        <HeartbeatTracker />
                        <MyAbacus />
                      </PageTransitionProvider>
                    </DeploymentInfoProvider>
                  </AudioHelpProvider>
                </MyAbacusProvider>
              </HomeHeroProvider>
            </FullscreenProvider>
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
