'use client'

import dynamic from 'next/dynamic'

const GameModeProviderWithHooks = dynamic(
  () => import('@/contexts/GameModeProviderWithHooks').then((m) => m.GameModeProviderWithHooks),
  { ssr: false }
)

/**
 * Number Line layout — wraps with GameModeProviderWithHooks so the
 * page can show a player selector and thread child identity to voice calls.
 */
export default function NumberLineLayout({ children }: { children: React.ReactNode }) {
  return <GameModeProviderWithHooks>{children}</GameModeProviderWithHooks>
}
