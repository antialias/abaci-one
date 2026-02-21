import { AbacusDisplayProvider } from '@soroban/abacus-react'
import type { Preview } from '@storybook/nextjs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { NextIntlClientProvider } from 'next-intl'
import { ToastProvider } from '../src/components/common/ToastContext'
import { AudioManagerProvider } from '../src/contexts/AudioManagerContext'
import { DeploymentInfoProvider } from '../src/contexts/DeploymentInfoContext'
import { FullscreenProvider } from '../src/contexts/FullscreenContext'
import { HomeHeroProvider } from '../src/contexts/HomeHeroContext'
import { LocaleProvider } from '../src/contexts/LocaleContext'
import { MyAbacusProvider } from '../src/contexts/MyAbacusContext'
import { PageTransitionProvider } from '../src/contexts/PageTransitionContext'
import { ThemeProvider } from '../src/contexts/ThemeContext'
import { UserProfileProvider } from '../src/contexts/UserProfileContext'
import { VisualDebugProvider } from '../src/contexts/VisualDebugContext'
import tutorialEn from '../src/i18n/locales/tutorial/en.json'

// Create a client for Storybook
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable retries in Storybook for faster feedback
      retry: false,
      // Disable refetch on window focus in Storybook
      refetchOnWindowFocus: false,
    },
  },
})
// Panda CSS - import the generated styles
import '../styled-system/styles.css'
// App global styles
import '../src/app/globals.css'

// Merge messages for Storybook (add more as needed)
const messages = {
  tutorial: tutorialEn.tutorial,
}

/**
 * Global Storybook decorator — mirrors the provider tree from ClientProviders
 * so that any page-level component can render without missing context errors.
 *
 * Stories that need a custom QueryClient (e.g. with seeded data) should provide
 * their own <QueryClientProvider> which will override this one.
 */
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <SessionProvider session={null}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <VisualDebugProvider>
              <LocaleProvider initialLocale="en" initialMessages={messages}>
                <NextIntlClientProvider locale="en" messages={messages}>
                  <ToastProvider>
                    <AbacusDisplayProvider>
                      <UserProfileProvider>
                        <FullscreenProvider>
                          <HomeHeroProvider>
                            <MyAbacusProvider>
                              <AudioManagerProvider>
                                <DeploymentInfoProvider>
                                  <PageTransitionProvider>
                                    <Story />
                                  </PageTransitionProvider>
                                </DeploymentInfoProvider>
                              </AudioManagerProvider>
                            </MyAbacusProvider>
                          </HomeHeroProvider>
                        </FullscreenProvider>
                      </UserProfileProvider>
                    </AbacusDisplayProvider>
                  </ToastProvider>
                </NextIntlClientProvider>
              </LocaleProvider>
            </VisualDebugProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SessionProvider>
    ),
  ],
}

export default preview
