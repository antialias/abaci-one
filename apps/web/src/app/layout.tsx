import type { Metadata, Viewport } from 'next'
import { dehydrate } from '@tanstack/react-query'
import './globals.css'
import { auth } from '@/auth'
import { ClientProviders } from '@/components/ClientProviders'
import { isAdminEmail } from '@/lib/auth/admin-emails'
import { getAllFlags } from '@/lib/feature-flags'
import { getQueryClient } from '@/lib/queryClient'
import { billingKeys, featureFlagKeys } from '@/lib/queryKeys'
import { getTierForUser } from '@/lib/subscription'
import { TIER_LIMITS } from '@/lib/tier-limits'
import { getRequestLocale } from '@/i18n/request'
import { getMessages } from '@/i18n/messages'

export const metadata: Metadata = {
  metadataBase: new URL('https://abaci.one'),
  title: {
    default: 'Abaci One — Adaptive Abacus Math Practice for Kids',
    template: '%s | Abaci One',
  },
  description:
    "Screen time that builds real math skills. Adaptive daily practice, printable materials, and multiplayer math games — all built around the world's most effective mental math tool.",
  keywords: [
    'soroban',
    'abacus',
    'Japanese abacus',
    'mental arithmetic',
    'math games',
    'abacus tutorial',
    'soroban learning',
    'arithmetic practice',
    'educational games',
    'math practice for kids',
    'adaptive math',
    'mental math for kids',
    'abacus for kids',
    'math screen time',
  ],
  authors: [{ name: 'Abaci One' }],
  creator: 'Abaci One',
  publisher: 'Abaci One',

  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['de_DE', 'ja_JP', 'hi_IN', 'es_ES', 'la'],
    url: 'https://abaci.one',
    title: 'Abaci One — Adaptive Abacus Math Practice for Kids',
    description:
      "Screen time that builds real math skills. Adaptive daily practice, printable materials, and multiplayer math games — all built around the world's most effective mental math tool.",
    siteName: 'Abaci One',
  },

  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'Abaci One — Adaptive Abacus Math Practice for Kids',
    description:
      'Adaptive abacus math practice for kids. Daily practice that adapts, multiplayer math games, and printable materials.',
  },

  // Icons
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },

  // App-specific
  applicationName: 'Abaci One',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Abaci One',
  },

  // Modern web app capable meta tag (non-Apple browsers)
  other: {
    'mobile-web-app-capable': 'yes',
  },

  // Category
  category: 'education',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale()
  const messages = await getMessages(locale)

  // Prefetch feature flags server-side so they're instantly available
  // on the client without an extra API request.
  // Session-aware: logged-in users get their per-user overrides merged in.
  const session = await auth()
  const userRole = session?.user?.id
    ? isAdminEmail(session.user.email)
      ? 'admin'
      : 'user'
    : 'guest'
  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: featureFlagKeys.all,
      queryFn: async () => ({ flags: await getAllFlags(session?.user?.id, userRole) }),
      staleTime: 60_000,
    }),
    queryClient.prefetchQuery({
      queryKey: billingKeys.tier(),
      queryFn: async () => {
        const tier =
          userRole === 'guest' ? ('guest' as const) : await getTierForUser(session?.user?.id)
        const limits = TIER_LIMITS[tier]
        return {
          tier,
          limits: {
            maxPracticeStudents:
              limits.maxPracticeStudents === Infinity ? null : limits.maxPracticeStudents,
            maxSessionMinutes: limits.maxSessionMinutes,
            maxSessionsPerWeek:
              limits.maxSessionsPerWeek === Infinity ? null : limits.maxSessionsPerWeek,
            maxOfflineParsingPerMonth: limits.maxOfflineParsingPerMonth,
          },
        }
      },
      staleTime: 60_000,
    }),
  ])

  return (
    <html lang={locale} suppressHydrationWarning>
      <body data-deploy-test="argocd-2026-01-31">
        <ClientProviders
          initialLocale={locale}
          initialMessages={messages}
          dehydratedState={dehydrate(queryClient)}
        >
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
