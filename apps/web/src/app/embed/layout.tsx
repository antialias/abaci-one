/**
 * Iframe-safe layout for the `/embed/...` routes.
 *
 * Strips the app's NavBar / shell — these pages are designed to be embedded
 * by chat clients (Twitter Player Card, Discord, Mastodon) inside a small
 * iframe and need to render *only* their featured content with no chrome.
 *
 * The root layout (`app/layout.tsx`) still wraps everything — ClientProviders,
 * fonts, etc. — but no nav, no footer.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
